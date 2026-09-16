import type { JsonValue } from "./types.js";

export const DEFAULT_STATE_BUDGET = 8000;

export function truncateUtf8(text: string, maxChars: number): string {
  if (maxChars <= 0) return "";
  const chars = Array.from(text);
  if (chars.length <= maxChars) return text;
  return chars.slice(0, maxChars).join("");
}

export interface PrioritizedField {
  value: unknown;
  priority: number;
}

export function truncateState(
  fields: Record<string, PrioritizedField>,
  budget = DEFAULT_STATE_BUDGET,
): Record<string, JsonValue> {
  const result: Record<string, JsonValue> = {};
  for (const [key, field] of Object.entries(fields)) {
    result[key] = toJson(field.value);
  }
  const ordered = Object.entries(fields).sort((a, b) => b[1].priority - a[1].priority);
  for (const [key] of ordered) {
    if (jsonSize(result) <= budget) break;
    const current = result[key];
    if (typeof current === "string") {
      let keep = current.length;
      while (keep > 16 && jsonSize(result) > budget) {
        keep = Math.max(16, Math.floor(keep / 2));
        result[key] = truncateUtf8(current, keep);
      }
      if (jsonSize(result) > budget) result[key] = "[truncated]";
    } else if (Array.isArray(current)) {
      while (current.length > 0 && jsonSize(result) > budget) {
        current.pop();
      }
      result[key] = current as JsonValue;
    } else if (current && typeof current === "object") {
      result[key] = { truncated: true } as JsonValue;
    }
  }
  if (jsonSize(result) > budget) {
    const encoded = JSON.stringify(result);
    return { truncated: truncateUtf8(encoded, Math.max(0, budget - 20)) };
  }
  return result;
}

function jsonSize(value: unknown): number {
  return JSON.stringify(value).length;
}

function toJson(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) return value.map(toJson);
  if (value && typeof value === "object") {
    const out: Record<string, JsonValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = toJson(v);
    }
    return out;
  }
  return String(value);
}
