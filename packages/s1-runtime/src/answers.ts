import type { NoulResponse, ScoreResponse } from "./types.js";

export function noulP(answers: unknown, key: string): number {
  if (!answers || typeof answers !== "object") return 0;
  const value = (answers as Record<string, unknown>)[key];
  if (!value || typeof value !== "object") return 0;
  const rec = value as Partial<NoulResponse>;
  if (rec.type === "noul" && typeof rec.noul === "number") return rec.noul;
  return 0;
}

export function scoreAnswer(answers: unknown, key: string): { score: number; confidence: number } {
  if (!answers || typeof answers !== "object") return { score: 0, confidence: 0 };
  const value = (answers as Record<string, unknown>)[key];
  if (!value || typeof value !== "object") return { score: 0, confidence: 0 };
  const rec = value as Partial<ScoreResponse>;
  return {
    score: typeof rec.score === "number" ? rec.score : 0,
    confidence: typeof rec.confidence === "number" ? rec.confidence : 0,
  };
}

