import { describe, expect, it } from "vitest";
import { formatHud } from "../src/index.js";
import type { BicameralDecision, BudgetSnapshot } from "../src/index.js";

describe("formatHud", () => {
  it("summarizes the last N decisions and counters", () => {
    const decisions: BicameralDecision[] = [
      {
        reflex: "gate",
        pack: "gate",
        packHash: "abc",
        backend: "fake",
        stateRedacted: {},
        questions: {},
        answers: { exfiltration: { type: "noul", noul: 0.91 } },
        policyRule: "exfiltration.block",
        action: { kind: "block" },
        latencyMs: 12,
      },
      {
        reflex: "honest_finish",
        pack: "edit_review",
        packHash: "def",
        backend: "fake",
        stateRedacted: {},
        questions: {},
        answers: { test_weakened: { type: "noul", noul: 0.82 } },
        policyRule: "test_weakened.followup",
        action: { kind: "followup" },
        latencyMs: 8,
      },
    ];
    const budget: BudgetSnapshot = {
      decisions: 12,
      timeouts: 1,
      fallbacks: 1,
      inputTokens: 4000,
      estimatedUsd: 0.003,
      p50Ms: 41,
      p95Ms: 120,
      degraded: false,
      s2InputTokens: 1_900_000,
      s2EstimatedUsd: 4.1,
    };
    const lines = formatHud(decisions, budget, 5);
    const text = lines.join("\n");
    expect(text).toMatch(/gate/i);
    expect(text).toMatch(/block/i);
    expect(text).toMatch(/honest/i);
    expect(text).toMatch(/12/);
    expect(text).toMatch(/41/);
  });
});
