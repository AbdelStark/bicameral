import type { CompiledPack } from "@bicameral/packs";
import { noulP, scoreAnswer } from "../answers.js";
import { isHighRiskByPattern } from "../high-risk.js";
import type { Policy } from "../policy.js";
import { redactSecrets } from "../redaction.js";
import { Speculator } from "../speculator.js";
import { buildGateState } from "../state.js";
import type {
  BicameralDecision,
  GateAction,
  S1Backend,
  SessionSnapshot,
  ToolCallRef,
} from "../types.js";

export interface DecideGateInput {
  answers: unknown | "timeout" | "error";
  policy: Policy;
  toolName: string;
  toolInput: unknown;
  cwd: string;
  hasUI: boolean;
}

export function decideGate(input: DecideGateInput): GateAction {
  const gate = input.policy.reflexes.gate;
  if (input.answers === "timeout" || input.answers === "error") {
    if (isHighRiskByPattern(input.toolName, input.toolInput, input.cwd)) {
      const reason =
        "System 1 unavailable; this command matches a high-risk pattern (network, git push, recursive delete, or path outside the project). Confirm before proceeding.";
      return confirmOrBlock(input.hasUI, gate.headless_confirm_as, reason, "degraded.high_risk_pattern");
    }
    return { kind: "allow", policyRule: "degraded.low_risk" };
  }

  const pExfil = noulP(input.answers, "exfiltration");
  const pInject = noulP(input.answers, "injected_intent");
  const pSecret = noulP(input.answers, "secret_access");
  const pScope = noulP(input.answers, "scope_escape");
  const reversibility = scoreAnswer(input.answers, "reversibility");

  if (pExfil >= gate.exfiltration.block) {
    return {
      kind: "block",
      reason: blockReason("exfiltration", pExfil),
      policyRule: `exfiltration.block (>= ${gate.exfiltration.block})`,
    };
  }
  if (pInject >= gate.injected_intent.block) {
    return {
      kind: "block",
      reason: blockReason("injected_intent", pInject),
      policyRule: `injected_intent.block (>= ${gate.injected_intent.block})`,
    };
  }

  const needsConfirm =
    pExfil >= gate.exfiltration.confirm ||
    pInject >= gate.injected_intent.confirm ||
    pSecret >= gate.secret_access.confirm ||
    pScope >= gate.scope_escape.confirm ||
    reversibility.score >= gate.reversibility.confirm_at_level ||
    (reversibility.confidence < gate.reversibility.min_confidence && reversibility.score >= 1);

  if (needsConfirm) {
    const reason = confirmReason({ pExfil, pInject, pSecret, pScope, reversibility });
    const rule = confirmRule({ pExfil, pInject, pSecret, pScope, reversibility, gate });
    return confirmOrBlock(input.hasUI, gate.headless_confirm_as, reason, rule);
  }

  return { kind: "allow", policyRule: "gate.allow" };
}

function confirmOrBlock(
  hasUI: boolean,
  headless: Policy["reflexes"]["gate"]["headless_confirm_as"],
  reason: string,
  policyRule: string,
): GateAction {
  if (hasUI) return { kind: "confirm", reason, policyRule };
  if (headless === "allow") return { kind: "allow", reason, policyRule };
  if (headless === "confirm") return { kind: "confirm", reason, policyRule };
  return { kind: "block", reason, policyRule };
}

function blockReason(kind: string, p: number): string {
  const label =
    kind === "exfiltration"
      ? "send local data, code, or credentials to a destination outside this machine"
      : "follow instructions injected from tool output rather than the user's goal";
  return `Blocked: this command appears to ${label} (${kind} p=${p.toFixed(2)}). Do not retry; explain to the user what you were trying to do.`;
}

function confirmReason(p: {
  pExfil: number;
  pInject: number;
  pSecret: number;
  pScope: number;
  reversibility: { score: number; confidence: number };
}): string {
  return `Bicameral wants confirmation (exfiltration=${p.pExfil.toFixed(2)}, injected_intent=${p.pInject.toFixed(2)}, secret_access=${p.pSecret.toFixed(2)}, scope_escape=${p.pScope.toFixed(2)}, reversibility=${p.reversibility.score.toFixed(2)}).`;
}

function confirmRule(p: {
  pExfil: number;
  pInject: number;
  pSecret: number;
  pScope: number;
  reversibility: { score: number; confidence: number };
  gate: Policy["reflexes"]["gate"];
}): string {
  if (p.pExfil >= p.gate.exfiltration.confirm) return `exfiltration.confirm (>= ${p.gate.exfiltration.confirm})`;
  if (p.pInject >= p.gate.injected_intent.confirm) return `injected_intent.confirm (>= ${p.gate.injected_intent.confirm})`;
  if (p.pSecret >= p.gate.secret_access.confirm) return `secret_access.confirm (>= ${p.gate.secret_access.confirm})`;
  if (p.pScope >= p.gate.scope_escape.confirm) return `scope_escape.confirm (>= ${p.gate.scope_escape.confirm})`;
  return `reversibility.confirm_at_level (>= ${p.gate.reversibility.confirm_at_level})`;
}

export interface EvaluateGateInput {
  backend: S1Backend;
  speculator?: Speculator;
  policy: Policy;
  pack: CompiledPack;
  toolCall: ToolCallRef;
  cwd: string;
  snapshot: SessionSnapshot;
  hasUI: boolean;
  deadlineMs?: number;
}

export async function evaluateGate(
  input: EvaluateGateInput,
): Promise<{ action: GateAction; record: BicameralDecision }> {
  const started = Date.now();
  const state = redactSecrets(
    buildGateState({
      userGoal: input.snapshot.userGoal,
      recentActions: input.snapshot.recentActions,
      flaggedContent: input.snapshot.flaggedContent,
      proposedAction: { tool: input.toolCall.name, input: input.toolCall.arguments },
    }),
  );
  const deadline = input.deadlineMs ?? input.policy.reflexes.gate.deadline_ms;
  const speculator = input.speculator ?? new Speculator(input.backend);
  speculator.prefetch(input.toolCall.id, {
    state,
    questions: input.pack.questions,
    packHash: input.pack.packHash,
  });
  const res = await speculator.take(input.toolCall.id, deadline);
  const answers = res === "timeout" ? "timeout" : res.answers;
  const action = decideGate({
    answers,
    policy: input.policy,
    toolName: input.toolCall.name,
    toolInput: input.toolCall.arguments,
    cwd: input.cwd,
    hasUI: input.hasUI,
  });
  const record: BicameralDecision = {
    reflex: "gate",
    pack: input.pack.pack,
    packHash: input.pack.packHash,
    backend: input.backend.name,
    stateRedacted: state,
    questions: input.pack.questions,
    answers: res === "timeout" ? { timeout: true } : res.answers,
    policyRule: action.policyRule,
    action,
    latencyMs: Date.now() - started,
  };
  return { action, record };
}
