import type { Questions } from "@typesafe-ai/sdk";
import { DecisionCache } from "./cache.js";
import type { JsonValue, S1Backend, S1Result } from "./types.js";

export interface PrefetchRequest<Q extends Questions = Questions> {
  state: JsonValue;
  questions: Q;
  packHash?: string;
}

export interface BatchItem<Q extends Questions = Questions> {
  id: string;
  questions: Q;
}

export class Speculator {
  private readonly inflight = new Map<string, Promise<S1Result | "timeout">>();
  private readonly controllers = new Map<string, AbortController>();
  private readonly cache: DecisionCache;

  constructor(
    private readonly backend: S1Backend,
    cache?: DecisionCache,
  ) {
    this.cache = cache ?? new DecisionCache();
  }

  prefetch(id: string, req: PrefetchRequest): void {
    if (this.inflight.has(id)) return;
    if (req.packHash) {
      const cached = this.cache.get(req.packHash, req.state);
      if (cached) {
        this.inflight.set(id, Promise.resolve(cached));
        return;
      }
    }
    const controller = new AbortController();
    this.controllers.set(id, controller);
    const work = this.backend
      .decide(req, { signal: controller.signal, timeoutMs: 60_000 })
      .then((res) => {
        if (req.packHash) this.cache.set(req.packHash, req.state, res);
        return res;
      })
      .catch(() => "timeout" as const);
    this.inflight.set(id, work);
  }

  prefetchBatch(items: BatchItem[], req: { state: JsonValue; packHash?: string }): void {
    const questions: Questions = {};
    for (const item of items) {
      for (const [key, question] of Object.entries(item.questions)) {
        questions[`${item.id}.${key}`] = question;
      }
    }
    const controller = new AbortController();
    const work = this.backend.decide(
      { state: req.state, questions, packHash: req.packHash },
      { signal: controller.signal, timeoutMs: 60_000 },
    );
    work.catch(() => undefined);
    for (const item of items) {
      this.controllers.set(item.id, controller);
      this.inflight.set(
        item.id,
        work
          .then((res) => denamespace(item.id, res))
          .catch(() => "timeout" as const),
      );
    }
  }

  async take(id: string, deadlineMs: number): Promise<S1Result | "timeout"> {
    let work = this.inflight.get(id);
    if (!work) return "timeout";
    const result = await Promise.race([work, sleep(deadlineMs).then(() => "timeout" as const)]);
    if (result === "timeout") {
      this.controllers.get(id)?.abort();
      work.catch(() => undefined);
    }
    return result;
  }
}

function denamespace(id: string, result: S1Result): S1Result {
  const prefix = `${id}.`;
  const answers: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(result.answers as Record<string, unknown>)) {
    if (key.startsWith(prefix)) answers[key.slice(prefix.length)] = value;
  }
  return { ...result, answers: answers as S1Result["answers"] };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
