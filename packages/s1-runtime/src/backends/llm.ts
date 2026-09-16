import type { Questions } from "@typesafe-ai/sdk";
import type { S1Backend, S1DecideOptions, S1DecideRequest, S1Result } from "../types.js";

/** Stub for the v0.2 LLM System 1 backend (H5 comparison). Not implemented in v0.1. */
export class LlmBackend implements S1Backend {
  readonly name: string;

  constructor(model = "llm:stub") {
    this.name = model.startsWith("llm:") ? model : `llm:${model}`;
  }

  decide<Q extends Questions>(_req: S1DecideRequest<Q>, _opts: S1DecideOptions): Promise<S1Result<Q>> {
    return Promise.reject(new Error("LlmBackend is not implemented in v0.1"));
  }
}

export class UnavailableBackend implements S1Backend {
  readonly name = "unavailable";

  decide<Q extends Questions>(_req: S1DecideRequest<Q>, _opts: S1DecideOptions): Promise<S1Result<Q>> {
    return Promise.reject(new Error("System 1 backend unavailable"));
  }
}
