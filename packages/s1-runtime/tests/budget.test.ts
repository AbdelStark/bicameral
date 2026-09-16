import { describe, expect, it } from "vitest";
import { BudgetTracker, formatHud } from "../src/index.js";
import type { BicameralDecision, BudgetSnapshot } from "../src/index.js";

describe("BudgetTracker.degraded", () => {
  it("is estimatedUsd >= s1_daily_usd, not timeout or fallback flags", () => {
    const s1DailyUsd = 5;
    const s1UsdPerMtok = 0.042;
    const tracker = new BudgetTracker({ s1DailyUsd, s1UsdPerMtok });

    tracker.record({ latencyMs: 12, timeout: true, fallback: true });
    expect(tracker.degraded).toBe(false);
    expect(tracker.snapshot().degraded).toBe(false);
    expect(tracker.snapshot().timeouts).toBe(1);
    expect(tracker.snapshot().fallbacks).toBe(1);
    expect(tracker.snapshot().estimatedUsd).toBe(0);

    const tokensToExceed = Math.ceil((s1DailyUsd / s1UsdPerMtok) * 1_000_000);
    tracker.record({ latencyMs: 8, inputTokens: tokensToExceed });
    expect(tracker.snapshot().estimatedUsd).toBeGreaterThanOrEqual(s1DailyUsd);
    expect(tracker.degraded).toBe(true);
    expect(tracker.snapshot().degraded).toBe(true);
  });
});

describe("formatHud degraded flag", () => {
  const empty: BicameralDecision[] = [];
  const base: BudgetSnapshot = {
    decisions: 3,
    timeouts: 2,
    fallbacks: 2,
    inputTokens: 0,
    estimatedUsd: 0,
    p50Ms: 41,
    p95Ms: 90,
    degraded: false,
    s2InputTokens: 0,
    s2EstimatedUsd: 0,
  };

  it("prints ok when budget.degraded is false even if timeouts were recorded", () => {
    const text = formatHud(empty, { ...base, timeouts: 2, fallbacks: 2, degraded: false }).join("\n");
    expect(text).toMatch(/· ok$/m);
    expect(text).not.toMatch(/DEGRADED/);
  });

  it("prints DEGRADED only when budget.degraded is true", () => {
    const text = formatHud(empty, { ...base, degraded: true, estimatedUsd: 5 }).join("\n");
    expect(text).toMatch(/DEGRADED/);
    expect(text).not.toMatch(/· ok$/m);
  });
});
