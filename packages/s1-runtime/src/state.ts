import { redactSecrets } from "./redaction.js";
import { DEFAULT_STATE_BUDGET, truncateState, truncateUtf8 } from "./truncation.js";
import type { JsonValue, SessionSnapshot, ToolCallRef } from "./types.js";

const DIFF_CONTEXT = 3;
const DIFF_MAX_LINES = 60;
const CONTENT_PREVIEW_LINES = 3;

export function summarizeProposedAction(tool: string, input: unknown): JsonValue {
  if (!input || typeof input !== "object") {
    return { tool, input: input as JsonValue };
  }
  const rec = input as Record<string, unknown>;
  const out: Record<string, JsonValue> = { tool };
  if (typeof rec.path === "string") out.path = rec.path;
  if (typeof rec.command === "string") out.command = truncateUtf8(rec.command, 500);
  if (typeof rec.content === "string") {
    const lines = rec.content.split("\n");
    out.content_chars = rec.content.length;
    out.content_preview = lines.slice(0, CONTENT_PREVIEW_LINES).join("\n");
  }
  if (Array.isArray(rec.edits)) {
    out.diff_hunks = summarizeEdits(rec.edits);
  }
  if (out.path === undefined && out.command === undefined && out.content_preview === undefined && out.diff_hunks === undefined) {
    out.input = redactSecrets(truncateDeep(rec, 400));
  }
  return out;
}

export function summarizeEdits(edits: unknown): string {
  if (!Array.isArray(edits)) return "";
  const lines: string[] = [];
  for (const edit of edits) {
    if (!edit || typeof edit !== "object") continue;
    const rec = edit as { oldText?: unknown; newText?: unknown };
    const oldText = typeof rec.oldText === "string" ? rec.oldText : "";
    const newText = typeof rec.newText === "string" ? rec.newText : "";
    lines.push("@@");
    for (const line of takeContext(oldText.split("\n"), DIFF_CONTEXT)) lines.push(`-${line}`);
    for (const line of takeContext(newText.split("\n"), DIFF_CONTEXT)) lines.push(`+${line}`);
    if (lines.length >= DIFF_MAX_LINES) break;
  }
  return lines.slice(0, DIFF_MAX_LINES).join("\n");
}

function takeContext(lines: string[], n: number): string[] {
  if (lines.length <= n * 2 + 1) return lines;
  return [...lines.slice(0, n), "...", ...lines.slice(-n)];
}

function truncateDeep(value: unknown, max: number): JsonValue {
  const json = JSON.stringify(value) ?? "null";
  if (json.length <= max) return value as JsonValue;
  return truncateUtf8(json, max);
}

export function buildGateState(
  input: {
    userGoal: string;
    recentActions: unknown[];
    flaggedContent: unknown[];
    proposedAction: { tool: string; input: unknown };
  },
  budget = DEFAULT_STATE_BUDGET,
): Record<string, JsonValue> {
  return truncateState(
    {
      user_goal: { value: input.userGoal, priority: 0 },
      proposed_action: {
        value: summarizeProposedAction(input.proposedAction.tool, input.proposedAction.input),
        priority: 1,
      },
      flagged_content: { value: input.flaggedContent, priority: 2 },
      recent_actions: { value: input.recentActions, priority: 3 },
    },
    budget,
  );
}

export function buildEditReviewState(
  input: {
    snapshot: SessionSnapshot;
    filePath: string;
    isTestPath: boolean;
    diffHunks: string;
  },
  budget = DEFAULT_STATE_BUDGET,
): Record<string, JsonValue> {
  return truncateState(
    {
      user_goal: { value: input.snapshot.userGoal, priority: 0 },
      file_path: { value: input.filePath, priority: 1 },
      is_test_path: { value: input.isTestPath, priority: 1 },
      diff_hunks: { value: input.diffHunks, priority: 2 },
      latest_test_outcome: { value: input.snapshot.latestTestOutcome ?? null, priority: 3 },
    },
    budget,
  );
}

export function buildFinishCheckState(snapshot: SessionSnapshot, budget = DEFAULT_STATE_BUDGET): Record<string, JsonValue> {
  return truncateState(
    {
      user_goal: { value: snapshot.userGoal, priority: 0 },
      final_assistant_text: { value: snapshot.finalAssistantText ?? "", priority: 1 },
      last_edit_summary: { value: snapshot.lastEditSummary ?? "", priority: 2 },
      verification_after_edit: { value: snapshot.verificationAfterEdit ?? null, priority: 3 },
    },
    budget,
  );
}

export function buildProgressState(
  input: { snapshot: SessionSnapshot; recentTurns: unknown[]; preSignals: unknown[] },
  budget = DEFAULT_STATE_BUDGET,
): Record<string, JsonValue> {
  return truncateState(
    {
      user_goal: { value: input.snapshot.userGoal, priority: 0 },
      pre_signals: { value: input.preSignals, priority: 1 },
      recent_turns: { value: input.recentTurns, priority: 2 },
    },
    budget,
  );
}

export function redactedState(state: unknown): JsonValue {
  return redactSecrets(state);
}

export function isTestPath(filePath: string): boolean {
  const p = filePath.replace(/\\/g, "/");
  return (
    /(^|\/)(__tests__|tests?|spec)(\/|$)/i.test(p) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/i.test(p) ||
    /(?:^|\/)test_[^/]+\.py$/i.test(p)
  );
}

export function toolCallFrom(tool: ToolCallRef): { tool: string; input: unknown } {
  return { tool: tool.name, input: tool.arguments };
}
