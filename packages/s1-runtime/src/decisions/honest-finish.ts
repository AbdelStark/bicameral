import type { CompiledPack } from "@bicameral/packs";
import { noulP } from "../answers.js";
import type { Policy } from "../policy.js";
import { redactSecrets } from "../redaction.js";
import { Speculator } from "../speculator.js";
import { buildEditReviewState, isTestPath, summarizeEdits } from "../state.js";
import type {
  BicameralDecision,
  HonestFinishDecision,
  S1Backend,
  SessionSnapshot,
  TextContent,
} from "../types.js";

export class HonestFinishSession {
  followupsThisPrompt = 0;
  tamperSuspected = false;

  resetPrompt(): void {
    this.followupsThisPrompt = 0;
  }
}

export interface DecideHonestFinishInput {
  answers: unknown;
  policy: Policy;
  followupsThisPrompt: number;
}

export function decideHonestFinish(input: DecideHonestFinishInput): HonestFinishDecision {
  const hf = input.policy.reflexes.honest_finish;
  const testWeakened = noulP(input.answers, "test_weakened");
  const stub = noulP(input.answers, "stub_introduced");
  const unverified = noulP(input.answers, "unverified_claim");

  const warn = testWeakened >= hf.test_weakened.warn || stub >= hf.stub_introduced.warn;
  const wantsFollowup =
    testWeakened >= hf.test_weakened.followup || unverified >= hf.unverified_claim.followup;
  const followup = wantsFollowup && input.followupsThisPrompt < hf.max_followups_per_prompt;

  let policyRule = "honest_finish.none";
  if (followup && testWeakened >= hf.test_weakened.followup) {
    policyRule = `test_weakened.followup (>= ${hf.test_weakened.followup})`;
  } else if (followup && unverified >= hf.unverified_claim.followup) {
    policyRule = `unverified_claim.followup (>= ${hf.unverified_claim.followup})`;
  } else if (testWeakened >= hf.test_weakened.warn) {
    policyRule = `test_weakened.warn (>= ${hf.test_weakened.warn})`;
  } else if (stub >= hf.stub_introduced.warn) {
    policyRule = `stub_introduced.warn (>= ${hf.stub_introduced.warn})`;
  }

  const warningText = warn
    ? testWeakened >= stub
      ? `Bicameral: this edit appears to weaken a test (p=${testWeakened.toFixed(2)}). If the test was wrong, say why explicitly.`
      : `Bicameral: this edit appears to introduce a stub or placeholder (p=${stub.toFixed(2)}). Replace it with a real implementation.`
    : undefined;

  const followupContent = followup
    ? testWeakened >= hf.test_weakened.followup
      ? `Bicameral follow-up: a test change looks like tampering (test_weakened p=${testWeakened.toFixed(2)}). Run the tests, justify the assertion change, or revert it.`
      : `Bicameral follow-up: success was claimed without verification (unverified_claim p=${unverified.toFixed(2)}). Run the relevant tests or build before concluding.`
    : undefined;

  return { warn, followup, warningText, followupContent, policyRule };
}

export interface EvaluateHonestFinishInput {
  backend: S1Backend;
  speculator?: Speculator;
  policy: Policy;
  pack: CompiledPack;
  toolName: string;
  toolInput: unknown;
  toolResultContent: TextContent[];
  snapshot: SessionSnapshot;
  session: HonestFinishSession;
  deadlineMs?: number;
}

export async function evaluateHonestFinish(
  input: EvaluateHonestFinishInput,
): Promise<{
  action: { kind: "none" | "warn" | "followup" };
  followup: boolean;
  patchedContent?: TextContent[];
  followupContent?: string;
  record: BicameralDecision;
}> {
  const started = Date.now();
  const rec = asRecord(input.toolInput);
  const filePath = typeof rec.path === "string" ? rec.path : "";
  const diffHunks = Array.isArray(rec.edits)
    ? summarizeEdits(rec.edits)
    : typeof rec.content === "string"
      ? summarizeEdits([{ oldText: "", newText: rec.content }])
      : "";
  const state = redactSecrets(
    buildEditReviewState({
      snapshot: input.snapshot,
      filePath,
      isTestPath: isTestPath(filePath),
      diffHunks,
    }),
  );
  const speculator = input.speculator ?? new Speculator(input.backend);
  const id = `honest:${filePath}:${started}`;
  speculator.prefetch(id, {
    state,
    questions: input.pack.questions,
    packHash: input.pack.packHash,
  });
  const res = await speculator.take(id, input.deadlineMs ?? input.policy.reflexes.honest_finish.deadline_ms);
  const answers = res === "timeout" ? {} : res.answers;
  const decision = decideHonestFinish({
    answers,
    policy: input.policy,
    followupsThisPrompt: input.session.followupsThisPrompt,
  });
  if (decision.followup) {
    input.session.followupsThisPrompt += 1;
    input.session.tamperSuspected = true;
  }
  const patchedContent =
    decision.warn && decision.warningText
      ? [...input.toolResultContent, { type: "text" as const, text: decision.warningText }]
      : undefined;
  const kind = decision.followup ? "followup" : decision.warn ? "warn" : "none";
  const record: BicameralDecision = {
    reflex: "honest_finish",
    pack: input.pack.pack,
    packHash: input.pack.packHash,
    backend: input.backend.name,
    stateRedacted: state,
    questions: input.pack.questions,
    answers,
    policyRule: decision.policyRule,
    action: { kind, followup: decision.followup, warn: decision.warn },
    latencyMs: Date.now() - started,
  };
  return {
    action: { kind },
    followup: decision.followup,
    patchedContent,
    followupContent: decision.followupContent,
    record,
  };
}

function asRecord(input: unknown): Record<string, unknown> {
  if (input && typeof input === "object") return input as Record<string, unknown>;
  return {};
}
