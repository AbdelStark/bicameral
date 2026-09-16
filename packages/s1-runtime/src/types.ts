import type {
  ChoiceResponse,
  JsonValue,
  NoulResponse,
  Questions,
  ScoreResponse,
  SystemOneResult,
} from "@typesafe-ai/sdk";

export type { JsonValue, Questions, NoulResponse, ScoreResponse, ChoiceResponse };

export type S1Result<Q extends Questions = Questions> = SystemOneResult<Q>;

export interface S1DecideRequest<Q extends Questions = Questions> {
  state: JsonValue;
  questions: Q;
  packHash?: string;
}

export interface S1DecideOptions {
  signal: AbortSignal;
  timeoutMs: number;
}

export interface S1Backend {
  readonly name: string;
  decide<Q extends Questions>(
    req: S1DecideRequest<Q>,
    opts: S1DecideOptions,
  ): Promise<S1Result<Q>>;
}

export interface SessionSnapshot {
  userGoal: string;
  recentActions: unknown[];
  flaggedContent: unknown[];
  finalAssistantText?: string;
  lastEditSummary?: string;
  verificationAfterEdit?: unknown;
  latestTestOutcome?: unknown;
}

export interface ToolCallRef {
  id: string;
  name: string;
  arguments: unknown;
}

export interface TextContent {
  type: "text";
  text: string;
}

export interface BicameralDecision {
  reflex: string;
  pack: string;
  packHash: string;
  backend: string;
  stateRedacted: JsonValue;
  questions: Questions;
  answers: unknown;
  policyRule: string;
  action: unknown;
  latencyMs: number;
  requestId?: string;
}

export interface BudgetSnapshot {
  decisions: number;
  timeouts: number;
  fallbacks: number;
  inputTokens: number;
  estimatedUsd: number;
  p50Ms: number;
  p95Ms: number;
  degraded: boolean;
  s2InputTokens: number;
  s2EstimatedUsd: number;
}

export type GateKind = "allow" | "confirm" | "block";

export interface GateAction {
  kind: GateKind;
  reason?: string;
  policyRule: string;
}

export interface HonestFinishDecision {
  warn: boolean;
  followup: boolean;
  warningText?: string;
  followupContent?: string;
  policyRule: string;
}

export interface StuckAction {
  kind: "none" | "steer" | "raise_thinking" | "ask_user";
  hint?: string;
  policyRule: string;
}

export interface PreSignal {
  type: "identical_command_error" | "oscillation";
  detail: string;
}

export interface TurnRecord {
  toolName: string;
  argsSummary: string;
  isError: boolean;
  errorLine?: string;
  filesEdited?: Array<{ path: string; hunkHash: string }>;
}
