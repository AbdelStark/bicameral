import type { Questions } from "@typesafe-ai/sdk";

export interface CompiledPack<Q extends Questions = Questions> {
  pack: string;
  version: number;
  description?: string;
  questions: Q;
  packHash: string;
}

export interface PackQuestionYaml {
  type: "noul" | "score" | "choice";
  instructions?: unknown;
  criteria?: unknown;
}

export interface PackYaml {
  pack: string;
  version: number;
  description?: string;
  state?: unknown;
  questions: Record<string, PackQuestionYaml>;
}

export interface BuiltinPacks {
  gate: CompiledPack;
  edit_review: CompiledPack;
  finish_check: CompiledPack;
  progress: CompiledPack;
}
