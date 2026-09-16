import type { Question, Questions } from "@typesafe-ai/sdk";
import type { S1Backend, S1DecideOptions, S1DecideRequest, S1Result } from "../types.js";

export interface FakeBackendOptions {
  name?: string;
  noul?: Record<string, number>;
  score?: Record<string, { score: number; confidence?: number; probabilities?: Record<number, number> }>;
  choice?: Record<string, { choice: string; confidence?: number; probabilities?: Record<string, number> }>;
  answers?: Record<string, unknown>;
  delayMs?: number;
  hang?: boolean;
  error?: Error;
  onDecide?: (req: S1DecideRequest) => void;
}

export class FakeBackend implements S1Backend {
  readonly name: string;
  private readonly opts: FakeBackendOptions;

  constructor(opts: FakeBackendOptions = {}) {
    this.opts = opts;
    this.name = opts.name ?? "fake";
  }

  async decide<Q extends Questions>(req: S1DecideRequest<Q>, opts: S1DecideOptions): Promise<S1Result<Q>> {
    this.opts.onDecide?.(req);
    if (this.opts.error) throw this.opts.error;
    if (this.opts.hang) {
      await hangUntilAbort(opts.signal);
    }
    if (this.opts.delayMs && this.opts.delayMs > 0) {
      await sleep(this.opts.delayMs, opts.signal);
    }
    const answers: Record<string, unknown> = {};
    for (const [name, question] of Object.entries(req.questions)) {
      answers[name] = this.answerFor(name, question);
    }
    return {
      model: "fake",
      answers: answers as S1Result<Q>["answers"],
      usage: { input_tokens: 0, output_tokens: 0 },
    };
  }

  private answerFor(name: string, question: Question): unknown {
    if (this.opts.answers?.[name] !== undefined) return this.opts.answers[name];
    if (question.type === "noul") {
      return { type: "noul", noul: this.opts.noul?.[name] ?? 0 };
    }
    if (question.type === "score") {
      const scripted = this.opts.score?.[name];
      const n = question.criteria.length;
      const score = scripted?.score ?? 0;
      const rounded = Math.min(n - 1, Math.max(0, Math.round(score)));
      const probabilities =
        scripted?.probabilities ??
        Object.fromEntries(Array.from({ length: n }, (_, i) => [i, i === rounded ? 1 : 0]));
      const legend = Object.fromEntries(question.criteria.map((c, i) => [i, c]));
      return {
        type: "score",
        score,
        confidence: scripted?.confidence ?? 1,
        probabilities,
        legend,
      };
    }
    const scripted = this.opts.choice?.[name];
    const labels = Object.keys(question.criteria);
    const choice = scripted?.choice ?? labels[0] ?? "unknown";
    const probabilities =
      scripted?.probabilities ?? Object.fromEntries(labels.map((l) => [l, l === choice ? 1 : 0]));
    return {
      type: "choice",
      choice,
      confidence: scripted?.confidence ?? 1,
      probabilities,
    };
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("aborted"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function hangUntilAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    const fail = () => reject(new Error("aborted"));
    if (signal.aborted) {
      fail();
      return;
    }
    signal.addEventListener("abort", fail, { once: true });
  });
}
