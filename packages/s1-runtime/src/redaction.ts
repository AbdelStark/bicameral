import type { JsonValue } from "./types.js";

const PRIVATE_KEY =
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g;
const JWT = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const AWS_KEY_ID = /\bAKIA[0-9A-Z]{16}\b/g;
const ASSIGNMENT =
  /\b(api[-_]?key|aws[_-]?secret[_-]?access[_-]?key|secret(?:[_-]?access[_-]?key)?|token|password|passwd|authorization)\b(\s*["']?\s*[:=]\s*["']?)([^\s"']+)/gi;

export function redactSecrets(value: unknown): JsonValue {
  return redactValue(value) as JsonValue;
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactValue(v);
    }
    return out;
  }
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

export function redactString(text: string): string {
  let out = text.replace(PRIVATE_KEY, "<REDACTED:private_key>");
  out = out.replace(JWT, "<REDACTED:jwt>");
  out = out.replace(AWS_KEY_ID, "<REDACTED:aws_key>");
  out = out.replace(ASSIGNMENT, (_m, key: string, sep: string) => {
    const kind = /token/i.test(key) && !/api/i.test(key) ? "high_entropy" : "secret";
    const labelled = /aws/i.test(key) ? "aws_key" : kind;
    return `${key}${sep}<REDACTED:${labelled}>`;
  });
  return out;
}
