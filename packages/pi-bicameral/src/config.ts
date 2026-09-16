import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_POLICY, parsePolicy, type Policy } from "@bicameral/s1-runtime";
import { FALLBACK_CONFIG_DIR_NAME } from "./pi-types.js";

export async function resolveConfigDirName(): Promise<string> {
  try {
    const mod = (await import("@earendil-works/pi-coding-agent")) as { CONFIG_DIR_NAME?: string };
    if (typeof mod.CONFIG_DIR_NAME === "string" && mod.CONFIG_DIR_NAME.length > 0) {
      return mod.CONFIG_DIR_NAME;
    }
  } catch {
    // optional peer
  }
  return FALLBACK_CONFIG_DIR_NAME;
}

export function loadMergedPolicy(opts: {
  cwd: string;
  configDirName: string;
  projectTrusted: boolean;
}): { policy: Policy; error?: string } {
  let policy = structuredClone(DEFAULT_POLICY);
  const globalPath = join(homedir(), opts.configDirName, "agent", "bicameral.yaml");
  const loaded = readPolicyFile(globalPath);
  if (loaded.policy) policy = loaded.policy;
  let error = loaded.error;
  if (opts.projectTrusted) {
    const projectPath = join(opts.cwd, opts.configDirName, "bicameral.yaml");
    const project = readPolicyFile(projectPath);
    if (project.policy) policy = project.policy;
    if (project.error) error = project.error;
  }
  return { policy, error };
}

function readPolicyFile(path: string): { policy?: Policy; error?: string } {
  if (!existsSync(path)) return {};
  try {
    return { policy: parsePolicy(readFileSync(path, "utf8")) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
