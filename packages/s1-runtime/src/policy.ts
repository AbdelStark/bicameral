import { parse as parseYaml } from "yaml";
import { z } from "zod";

export type PolicyMode = "observe" | "enforce";
export type PolicyBackend = "typesafe" | "llm" | "fake";
export type HeadlessConfirmAs = "block" | "allow" | "confirm";

export interface GatePolicy {
  enabled: boolean;
  deadline_ms: number;
  exfiltration: { block: number; confirm: number };
  injected_intent: { block: number; confirm: number };
  secret_access: { confirm: number };
  scope_escape: { confirm: number };
  reversibility: { confirm_at_level: number; min_confidence: number };
  headless_confirm_as: HeadlessConfirmAs;
}

export interface HonestFinishPolicy {
  enabled: boolean;
  deadline_ms: number;
  test_weakened: { warn: number; followup: number };
  stub_introduced: { warn: number };
  unverified_claim: { followup: number };
  max_followups_per_prompt: number;
}

export interface StuckPolicy {
  enabled: boolean;
  deadline_ms: number;
  window_turns: number;
  repeat_failure: { steer: number };
  no_progress: { steer: number; raise_thinking: number; ask_user_after: number };
}

export interface Policy {
  version: number;
  backend: PolicyBackend;
  llm_backend_model?: string;
  mode: PolicyMode;
  budget: { s1_daily_usd: number; s1_usd_per_mtok: number };
  reflexes: {
    gate: GatePolicy;
    honest_finish: HonestFinishPolicy;
    stuck: StuckPolicy;
  };
}

export const DEFAULT_POLICY: Policy = {
  version: 1,
  backend: "typesafe",
  mode: "enforce",
  budget: { s1_daily_usd: 5, s1_usd_per_mtok: 0.042 },
  reflexes: {
    gate: {
      enabled: true,
      deadline_ms: 900,
      exfiltration: { block: 0.6, confirm: 0.25 },
      injected_intent: { block: 0.8, confirm: 0.4 },
      secret_access: { confirm: 0.5 },
      scope_escape: { confirm: 0.5 },
      reversibility: { confirm_at_level: 2, min_confidence: 0.5 },
      headless_confirm_as: "block",
    },
    honest_finish: {
      enabled: true,
      deadline_ms: 900,
      test_weakened: { warn: 0.5, followup: 0.75 },
      stub_introduced: { warn: 0.6 },
      unverified_claim: { followup: 0.7 },
      max_followups_per_prompt: 2,
    },
    stuck: {
      enabled: true,
      deadline_ms: 900,
      window_turns: 6,
      repeat_failure: { steer: 0.7 },
      no_progress: { steer: 0.7, raise_thinking: 0.85, ask_user_after: 3 },
    },
  },
};

const OverlaySchema = z
  .object({
    version: z.number().int().optional(),
    backend: z.enum(["typesafe", "llm", "fake"]).optional(),
    llm_backend_model: z.string().optional(),
    mode: z.enum(["observe", "enforce"]).optional(),
    budget: z
      .object({
        s1_daily_usd: z.number().optional(),
        s1_usd_per_mtok: z.number().optional(),
      })
      .passthrough()
      .optional(),
    reflexes: z.record(z.unknown()).optional(),
  })
  .passthrough();

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function deepMerge<T>(base: T, overlay: unknown): T {
  if (overlay === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(overlay)) return overlay as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(overlay)) {
    if (value === undefined) continue;
    out[key] = key in out ? deepMerge(out[key], value) : value;
  }
  return out as T;
}

export function mergePolicy(base: Policy, overlay: unknown): Policy {
  return deepMerge(base, overlay);
}

export function parsePolicy(yamlSource: string): Policy {
  const parsed = parseYaml(yamlSource);
  const overlay = OverlaySchema.parse(parsed);
  return mergePolicy(structuredClone(DEFAULT_POLICY), overlay);
}

export class PolicyStore {
  policy: Policy = structuredClone(DEFAULT_POLICY);
  lastError?: string;

  loadYaml(text: string): { ok: boolean; error?: string } {
    try {
      this.policy = parsePolicy(text);
      this.lastError = undefined;
      return { ok: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.lastError = error;
      return { ok: false, error };
    }
  }
}
