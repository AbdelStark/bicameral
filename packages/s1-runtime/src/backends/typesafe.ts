import { TypeSafeClient, type EntryType, type Questions, type TypeSafeClientConfig } from "@typesafe-ai/sdk";
import type { S1Backend, S1DecideOptions, S1DecideRequest, S1Result } from "../types.js";

export class TypeSafeBackend implements S1Backend {
  readonly name: string;
  private readonly client: TypeSafeClient;

  constructor(config: TypeSafeClientConfig = {}) {
    this.client = new TypeSafeClient({
      ...config,
      retry: { maxRetries: 0, ...config.retry },
    });
    this.name = `typesafe:${config.defaultModel ?? "jev-latest"}`;
  }

  async decide<Q extends Questions>(req: S1DecideRequest<Q>, opts: S1DecideOptions): Promise<S1Result<Q>> {
    return this.client.systemOne(
      { state: req.state as EntryType, questions: req.questions },
      { signal: opts.signal, timeout: opts.timeoutMs, retry: { maxRetries: 0 } },
    );
  }
}
