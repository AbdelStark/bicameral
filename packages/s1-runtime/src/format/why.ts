import type { BicameralDecision } from "../types.js";

export function formatWhy(record: BicameralDecision): string {
  const lines: string[] = [];
  lines.push(`Reflex: ${record.reflex}`);
  lines.push(`Pack: ${record.pack} (${record.packHash})`);
  lines.push(`Backend: ${record.backend}`);
  lines.push(`Action: ${actionLabel(record.action)}`);
  lines.push(`Policy rule: ${record.policyRule}`);
  lines.push(`Latency: ${record.latencyMs}ms`);
  if (record.requestId) lines.push(`Request id: ${record.requestId}`);
  lines.push("");
  lines.push("Questions and answers:");
  const answers = asRecord(record.answers);
  const questionNames = new Set([...Object.keys(asRecord(record.questions)), ...Object.keys(answers)]);
  for (const name of questionNames) {
    const q = asRecord(record.questions)[name];
    const a = answers[name];
    lines.push(`  ${name}${questionType(q)}: ${formatAnswer(a)}`);
  }
  lines.push("");
  lines.push("State (redacted):");
  lines.push(indent(JSON.stringify(record.stateRedacted, null, 2)));
  return lines.join("\n");
}

function actionLabel(action: unknown): string {
  if (action && typeof action === "object" && "kind" in action) {
    const rec = action as { kind: string; reason?: string };
    return rec.reason ? `${rec.kind} — ${rec.reason}` : rec.kind;
  }
  return JSON.stringify(action);
}

function questionType(q: unknown): string {
  if (q && typeof q === "object" && "type" in q) return ` (${String((q as { type: string }).type)})`;
  return "";
}

function formatAnswer(answer: unknown): string {
  if (!answer || typeof answer !== "object") return String(answer);
  const rec = answer as Record<string, unknown>;
  if (rec.type === "noul") return `noul=${rec.noul}`;
  if (rec.type === "score") return `score=${rec.score} confidence=${rec.confidence}`;
  if (rec.type === "choice") return `choice=${rec.choice} confidence=${rec.confidence}`;
  return JSON.stringify(answer);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return {};
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}
