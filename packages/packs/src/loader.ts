import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  choice,
  noul,
  score,
  type ChoiceCriteria,
  type EntryType,
  type NoulQuestion,
  type Questions,
  type ScoreCriteria,
} from "@typesafe-ai/sdk";
import { parse as parseYaml } from "yaml";
import { sha256Canonical } from "./canonical.js";
import type { BuiltinPacks, CompiledPack, PackQuestionYaml, PackYaml } from "./types.js";

function compileQuestion(name: string, q: PackQuestionYaml): Questions[string] {
  if (!q || typeof q !== "object" || typeof q.type !== "string") {
    throw new Error(`Invalid question "${name}"`);
  }
  if (q.type === "noul") {
    return noul(asEntry(q.instructions), asNoulCriteria(q.criteria));
  }
  if (q.type === "score") {
    if (!Array.isArray(q.criteria) || q.criteria.length < 2) {
      throw new Error(`Score question "${name}" needs at least two criteria`);
    }
    const criteria = q.criteria as unknown as ScoreCriteria;
    return score(asEntry(q.instructions), criteria);
  }
  if (q.type === "choice") {
    if (!q.criteria || typeof q.criteria !== "object" || Array.isArray(q.criteria)) {
      throw new Error(`Choice question "${name}" needs a criteria object`);
    }
    return choice(asEntry(q.instructions), q.criteria as ChoiceCriteria);
  }
  throw new Error(`Unknown question type "${String((q as { type?: string }).type)}" for "${name}"`);
}

function asEntry(value: unknown): EntryType {
  if (value === undefined) return null;
  return value as EntryType;
}

function asNoulCriteria(value: unknown): NoulQuestion["criteria"] {
  if (value === undefined || value === null) return undefined;
  return value as NoulQuestion["criteria"];
}

export function loadPack(yamlSource: string): CompiledPack {
  const parsed = parseYaml(yamlSource) as PackYaml;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Pack YAML must be a mapping");
  }
  if (typeof parsed.pack !== "string" || parsed.pack.length === 0) {
    throw new Error("Pack YAML requires pack: <name>");
  }
  if (typeof parsed.version !== "number" || !Number.isInteger(parsed.version) || parsed.version < 1) {
    throw new Error("Pack YAML requires integer version >= 1");
  }
  if (!parsed.questions || typeof parsed.questions !== "object" || Array.isArray(parsed.questions)) {
    throw new Error("Pack YAML requires a questions mapping");
  }
  const names = Object.keys(parsed.questions);
  if (names.length === 0) {
    throw new Error("Pack YAML requires at least one question");
  }
  const questions: Questions = {};
  for (const name of names) {
    const q = parsed.questions[name];
    if (!q) throw new Error(`Missing question "${name}"`);
    questions[name] = compileQuestion(name, q);
  }
  const packHash = sha256Canonical({
    pack: parsed.pack,
    version: parsed.version,
    questions,
  });
  const compiled: CompiledPack = {
    pack: parsed.pack,
    version: parsed.version,
    questions,
    packHash,
  };
  if (typeof parsed.description === "string") compiled.description = parsed.description;
  return compiled;
}

export function loadPackFile(path: string): CompiledPack {
  return loadPack(readFileSync(path, "utf8"));
}

export function builtinYamlDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "../yaml");
}

export function loadBuiltinPacks(): BuiltinPacks {
  const dir = builtinYamlDir();
  return {
    gate: loadPackFile(join(dir, "gate.yaml")),
    edit_review: loadPackFile(join(dir, "edit_review.yaml")),
    finish_check: loadPackFile(join(dir, "finish_check.yaml")),
    progress: loadPackFile(join(dir, "progress.yaml")),
  };
}
