import { isAbsolute, relative, resolve, sep } from "node:path";

const NETWORK_TOOLS = new Set([
  "web_fetch",
  "web_search",
  "browser",
  "http",
  "fetch",
  "mcp_web",
]);

const NETWORK_CMD = /\b(curl|wget|nc|ncat|netcat|ssh|scp|sftp|ftp|telnet|nmap|httpie)\b/i;
const INSTALL_CMD =
  /\b((npm|pnpm|yarn|bun)\s+(i|install|add)|pip3?\s+install|uv\s+add|apt(-get)?\s+install|brew\s+install|cargo\s+install)\b/i;
const GIT_PUSH = /\bgit\s+push\b/i;
const RM_RECURSIVE = /\brm\s+(?:-[a-zA-Z]*r[a-zA-Z]*|--recursive)\b/;

export function isHighRiskByPattern(toolName: string, input: unknown, cwd: string): boolean {
  const name = toolName.toLowerCase();
  if (NETWORK_TOOLS.has(name)) return true;
  const rec = asRecord(input);
  const command = typeof rec.command === "string" ? rec.command : "";
  if (name === "bash" || name === "powershell" || command) {
    if (NETWORK_CMD.test(command) || INSTALL_CMD.test(command) || GIT_PUSH.test(command) || RM_RECURSIVE.test(command)) {
      return true;
    }
  }
  const pathValue = typeof rec.path === "string" ? rec.path : undefined;
  if (pathValue && isOutsideCwd(pathValue, cwd)) return true;
  return false;
}

export function isOutsideCwd(filePath: string, cwd: string): boolean {
  const root = resolve(cwd);
  const resolved = resolve(cwd, filePath);
  const rel = relative(root, resolved);
  if (!rel) return false;
  return rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel);
}

function asRecord(input: unknown): Record<string, unknown> {
  if (input && typeof input === "object") return input as Record<string, unknown>;
  return {};
}
