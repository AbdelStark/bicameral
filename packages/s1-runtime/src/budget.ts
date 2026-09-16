import type { BudgetSnapshot } from "./types.js";

export class BudgetTracker {
  decisions = 0;
  timeouts = 0;
  fallbacks = 0;
  inputTokens = 0;
  estimatedUsd = 0;
  s2InputTokens = 0;
  s2EstimatedUsd = 0;
  private readonly latencies: number[] = [];
  private readonly dailyCapUsd: number;
  private readonly usdPerMtok: number;

  constructor(opts: { s1DailyUsd?: number; s1UsdPerMtok?: number } = {}) {
    this.dailyCapUsd = opts.s1DailyUsd ?? 5;
    this.usdPerMtok = opts.s1UsdPerMtok ?? 0.042;
  }

  record(opts: { latencyMs: number; inputTokens?: number; timeout?: boolean; fallback?: boolean }): void {
    this.decisions += 1;
    this.latencies.push(opts.latencyMs);
    if (opts.timeout) this.timeouts += 1;
    if (opts.fallback) this.fallbacks += 1;
    if (opts.inputTokens) {
      this.inputTokens += opts.inputTokens;
      this.estimatedUsd += (opts.inputTokens / 1_000_000) * this.usdPerMtok;
    }
  }

  get degraded(): boolean {
    return this.estimatedUsd >= this.dailyCapUsd;
  }

  snapshot(): BudgetSnapshot {
    const sorted = [...this.latencies].sort((a, b) => a - b);
    return {
      decisions: this.decisions,
      timeouts: this.timeouts,
      fallbacks: this.fallbacks,
      inputTokens: this.inputTokens,
      estimatedUsd: this.estimatedUsd,
      p50Ms: percentile(sorted, 0.5),
      p95Ms: percentile(sorted, 0.95),
      degraded: this.degraded,
      s2InputTokens: this.s2InputTokens,
      s2EstimatedUsd: this.s2EstimatedUsd,
    };
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx] ?? 0;
}
