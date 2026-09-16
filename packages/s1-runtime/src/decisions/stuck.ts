import type { CompiledPack } from "@bicameral/packs";
import { noulP } from "../answers.js";
import type { Policy } from "../policy.js";
import { redactSecrets } from "../redaction.js";
import { Speculator } from "../speculator.js";
import { buildProgressState } from "../state.js";
import type {
  BicameralDecision,
  PreSignal,
  S1Backend,
  SessionSnapshot,
  StuckAction,
  TurnRecord,
} from "../types.js";

export class StuckTracker {
  private readonly windowTurns: number;
  private readonly turns: TurnRecord[] = [];

  constructor(opts: { windowTurns: number }) {
    this.windowTurns = opts.windowTurns;
  }

  record(turn: TurnRecord): void {
    this.turns.push(turn);
    while (this.turns.length > this.windowTurns) this.turns.shift();
  }

  get recent(): readonly TurnRecord[] {
    return this.turns;
  }

  preSignals(): PreSignal[] {
    const signals: PreSignal[] = [];
    const latest = this.turns[this.turns.length - 1];
    if (!latest) return signals;
    if (latest.isError) {
      const prior = this.turns.slice(0, -1).find(
        (t) =>
          t.isError &&
          t.toolName === latest.toolName &&
          t.argsSummary === latest.argsSummary &&
          t.errorLine === latest.errorLine,
      );
      if (prior) {
        signals.push({
          type: "identical_command_error",
          detail: `${latest.toolName} ${latest.argsSummary} → ${latest.errorLine ?? "error"}`,
        });
      }
    }
    const hashes = latest.filesEdited ?? [];
    for (const file of hashes) {
      const history = this.turns.flatMap((t) => t.filesEdited ?? []).filter((f) => f.path === file.path);
      const unique = new Set(history.map((h) => h.hunkHash));
      if (history.length >= 3 && unique.size <= 2) {
        signals.push({
          type: "oscillation",
          detail: `${file.path} oscillated between ${[...unique].join(" / ")}`,
        });
      }
    }
    return signals;
  }

  shouldConsultSystem1(everyN = 3): boolean {
    if (this.preSignals().length > 0) return true;
    return this.turns.length > 0 && this.turns.length % everyN === 0;
  }
}

export function decideStuck(input: {
  answers: unknown;
  preSignals: PreSignal[];
  policy: Policy;
}): StuckAction {
  const stuck = input.policy.reflexes.stuck;
  const repeat = noulP(input.answers, "repeat_failure");
  const osc = noulP(input.answers, "oscillation");
  const noProgress = noulP(input.answers, "no_progress");
  const ignored = noulP(input.answers, "root_cause_ignored");

  if (repeat >= stuck.repeat_failure.steer) {
    return {
      kind: "steer",
      hint: templateHint("repeat_failure", input.preSignals),
      policyRule: `repeat_failure.steer (>= ${stuck.repeat_failure.steer})`,
    };
  }
  if (osc >= stuck.repeat_failure.steer) {
    return {
      kind: "steer",
      hint: templateHint("oscillation", input.preSignals),
      policyRule: `oscillation.steer (>= ${stuck.repeat_failure.steer})`,
    };
  }
  if (noProgress >= stuck.no_progress.steer) {
    const kind = noProgress >= stuck.no_progress.raise_thinking ? "raise_thinking" : "steer";
    return {
      kind,
      hint: templateHint(ignored >= 0.5 ? "root_cause_ignored" : "no_progress", input.preSignals),
      policyRule:
        kind === "raise_thinking"
          ? `no_progress.raise_thinking (>= ${stuck.no_progress.raise_thinking})`
          : `no_progress.steer (>= ${stuck.no_progress.steer})`,
    };
  }
  return { kind: "none", policyRule: "stuck.none" };
}

export function templateHint(
  kind: "repeat_failure" | "oscillation" | "no_progress" | "root_cause_ignored",
  preSignals: PreSignal[],
): string {
  const identical = preSignals.find((s) => s.type === "identical_command_error");
  const osc = preSignals.find((s) => s.type === "oscillation");
  if (kind === "repeat_failure" || kind === "root_cause_ignored") {
    const error = identical?.detail ?? "the same error";
    return `You ran the same command twice and got the same error: ${error}. Stop repeating it. Inspect the error, change the command or the environment, then retry once.`;
  }
  if (kind === "oscillation") {
    return `Edits are oscillating (${osc?.detail ?? "two alternating changes"}). Pick one approach, or revert and rethink the goal.`;
  }
  return "The last turns made no measurable progress toward the goal. Change strategy: read the error, inspect the relevant files, then take a different action.";
}

export interface EvaluateStuckInput {
  backend: S1Backend;
  speculator?: Speculator;
  policy: Policy;
  pack: CompiledPack;
  tracker: StuckTracker;
  snapshot: SessionSnapshot;
  deadlineMs?: number;
}

export async function evaluateStuck(
  input: EvaluateStuckInput,
): Promise<{ action: StuckAction; hint?: string; record: BicameralDecision }> {
  const started = Date.now();
  const preSignals = input.tracker.preSignals();
  if (!input.tracker.shouldConsultSystem1()) {
    const action: StuckAction = { kind: "none", policyRule: "stuck.idle" };
    return {
      action,
      record: {
        reflex: "stuck",
        pack: input.pack.pack,
        packHash: input.pack.packHash,
        backend: input.backend.name,
        stateRedacted: {},
        questions: input.pack.questions,
        answers: {},
        policyRule: action.policyRule,
        action,
        latencyMs: Date.now() - started,
      },
    };
  }
  const state = redactSecrets(
    buildProgressState({
      snapshot: input.snapshot,
      recentTurns: [...input.tracker.recent],
      preSignals,
    }),
  );
  const speculator = input.speculator ?? new Speculator(input.backend);
  const id = `stuck:${started}`;
  speculator.prefetch(id, {
    state,
    questions: input.pack.questions,
    packHash: input.pack.packHash,
  });
  const res = await speculator.take(id, input.deadlineMs ?? input.policy.reflexes.stuck.deadline_ms);
  const answers = res === "timeout" ? {} : res.answers;
  const action = decideStuck({ answers, preSignals, policy: input.policy });
  const record: BicameralDecision = {
    reflex: "stuck",
    pack: input.pack.pack,
    packHash: input.pack.packHash,
    backend: input.backend.name,
    stateRedacted: state,
    questions: input.pack.questions,
    answers,
    policyRule: action.policyRule,
    action,
    latencyMs: Date.now() - started,
  };
  return { action, hint: action.hint, record };
}
