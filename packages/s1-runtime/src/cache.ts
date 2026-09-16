import { createHash } from "node:crypto";
import { canonicalize } from "@bicameral/packs";
import type { JsonValue, S1Result } from "./types.js";

const DEFAULT_TTL_MS = 10 * 60 * 1000;

export function cacheKey(packHash: string, state: JsonValue): string {
  return createHash("sha256").update(`${packHash}:${canonicalize(state)}`).digest("hex");
}

export class DecisionCache {
  private readonly ttlMs: number;
  private readonly map = new Map<string, { expires: number; result: S1Result }>();

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  get(packHash: string, state: JsonValue): S1Result | undefined {
    const key = cacheKey(packHash, state);
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.result;
  }

  set(packHash: string, state: JsonValue, result: S1Result): void {
    this.map.set(cacheKey(packHash, state), { expires: Date.now() + this.ttlMs, result });
  }
}
