import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY, mergePolicy, parsePolicy, PolicyStore } from "../src/index.js";

const VALID = `
version: 1
backend: typesafe
mode: enforce
budget:
  s1_daily_usd: 5
reflexes:
  gate:
    enabled: true
    deadline_ms: 900
    exfiltration: { block: 0.60, confirm: 0.25 }
    injected_intent: { block: 0.80, confirm: 0.40 }
    secret_access: { confirm: 0.50 }
    scope_escape: { confirm: 0.50 }
    reversibility: { confirm_at_level: 2, min_confidence: 0.5 }
    headless_confirm_as: block
  honest_finish:
    enabled: true
    test_weakened: { warn: 0.50, followup: 0.75 }
    stub_introduced: { warn: 0.60 }
    unverified_claim: { followup: 0.70 }
    max_followups_per_prompt: 2
  stuck:
    enabled: true
    window_turns: 6
    repeat_failure: { steer: 0.70 }
    no_progress: { steer: 0.70, raise_thinking: 0.85, ask_user_after: 3 }
`;

describe("parsePolicy", () => {
  it("parses the v0.1 policy subset", () => {
    const policy = parsePolicy(VALID);
    expect(policy.mode).toBe("enforce");
    expect(policy.reflexes.gate.exfiltration.block).toBe(0.6);
    expect(policy.reflexes.honest_finish.test_weakened.followup).toBe(0.75);
    expect(policy.reflexes.stuck.repeat_failure.steer).toBe(0.7);
  });

  it("rejects invalid YAML / schema", () => {
    expect(() => parsePolicy("version: []\nmode: no-such-mode\n")).toThrow();
  });
});

describe("mergePolicy", () => {
  it("overlays project keys onto defaults", () => {
    const merged = mergePolicy(DEFAULT_POLICY, {
      reflexes: {
        gate: {
          exfiltration: { block: 0.9 },
        },
      },
    });
    expect(merged.reflexes.gate.exfiltration.block).toBe(0.9);
    expect(merged.reflexes.gate.exfiltration.confirm).toBe(
      DEFAULT_POLICY.reflexes.gate.exfiltration.confirm,
    );
    expect(merged.reflexes.stuck.enabled).toBe(true);
  });
});

describe("PolicyStore", () => {
  it("keeps the previous policy when a new file is invalid", () => {
    const store = new PolicyStore();
    const first = store.loadYaml(VALID);
    expect(first.ok).toBe(true);
    const previous = store.policy;
    const second = store.loadYaml(":::not yaml");
    expect(second.ok).toBe(false);
    expect(second.error).toBeTruthy();
    expect(store.policy).toEqual(previous);
    expect(store.policy.reflexes.gate.exfiltration.block).toBe(0.6);
  });
});
