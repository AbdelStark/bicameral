import type { BicameralDecision, BudgetSnapshot } from "../types.js";

export function formatHud(decisions: BicameralDecision[], budget: BudgetSnapshot, lastN = 5): string[] {
  const recent = decisions.slice(-lastN);
  const lines = recent.map(formatDecisionRow);
  const mode = budget.degraded ? "DEGRADED" : "ok";
  lines.push(
    `S1 ${budget.decisions} decisions · ${budget.p50Ms}ms p50 · $${budget.estimatedUsd.toFixed(3)} / S2 ${formatTok(budget.s2InputTokens)} tok · $${budget.s2EstimatedUsd.toFixed(2)} · ${mode}`,
  );
  return lines;
}

function formatDecisionRow(d: BicameralDecision): string {
  const kind = actionKind(d.action);
  const top = topProbability(d.answers);
  const bar = probabilityBar(top.value);
  return `${d.reflex} · ${d.pack} · ${top.label} ${top.value.toFixed(2)} ${bar} · ${kind} · ${d.latencyMs}ms`;
}

function actionKind(action: unknown): string {
  if (action && typeof action === "object" && "kind" in action) return String((action as { kind: string }).kind);
  return String(action);
}

function topProbability(answers: unknown): { label: string; value: number } {
  if (!answers || typeof answers !== "object") return { label: "—", value: 0 };
  let best = { label: "—", value: -1 };
  for (const [name, value] of Object.entries(answers as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const rec = value as { type?: string; noul?: number; score?: number; confidence?: number };
    const n = rec.type === "noul" ? rec.noul ?? 0 : rec.type === "score" ? rec.score ?? 0 : rec.confidence ?? 0;
    if (n > best.value) best = { label: name, value: n };
  }
  return best.value < 0 ? { label: "—", value: 0 } : best;
}

function probabilityBar(p: number): string {
  const filled = Math.max(0, Math.min(10, Math.round(p * 10)));
  return `${"█".repeat(filled)}${"░".repeat(10 - filled)}`;
}

function formatTok(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
