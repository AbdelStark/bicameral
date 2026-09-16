import { loadBuiltinPacks } from "@bicameral/packs";
import {
  BudgetTracker,
  DEFAULT_POLICY,
  buildGateState,
  evaluateGate,
  evaluateHonestFinish,
  evaluateStuck,
  FakeBackend,
  formatHud,
  formatWhy,
  HonestFinishSession,
  isTestPath,
  redactSecrets,
  Speculator,
  StuckTracker,
  TypeSafeBackend,
  UnavailableBackend,
  type BicameralDecision,
  type Policy,
  type S1Backend,
  type SessionSnapshot,
  type TextContent,
} from "@bicameral/s1-runtime";
import { loadMergedPolicy, resolveConfigDirName } from "./config.js";
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolCallEvent,
  ToolResultEvent,
  TurnEndEvent,
} from "./pi-types.js";

export interface BicameralOptions {
  backend?: S1Backend;
  policy?: Policy;
  configDirName?: string;
}

export function createBicameralExtension(options: BicameralOptions = {}) {
  return (pi: ExtensionAPI): void => {
    const packs = loadBuiltinPacks();
    const backend = options.backend ?? defaultBackend();
    const speculator = new Speculator(backend);
    let policy = structuredClone(options.policy ?? DEFAULT_POLICY);
    const snapshot: SessionSnapshot = { userGoal: "current task", recentActions: [], flaggedContent: [] };
    const stuck = new StuckTracker({ windowTurns: policy.reflexes.stuck.window_turns });
    const honest = new HonestFinishSession();
    const budget = new BudgetTracker({
      s1DailyUsd: policy.budget.s1_daily_usd,
      s1UsdPerMtok: policy.budget.s1_usd_per_mtok,
    });
    const decisions: BicameralDecision[] = [];
    let configDirName = options.configDirName;

    pi.on("session_start", async (_event, ctx) => {
      if (!options.policy) {
        configDirName = configDirName ?? (await resolveConfigDirName());
        const loaded = loadMergedPolicy({
          cwd: ctx.cwd,
          configDirName,
          projectTrusted: ctx.isProjectTrusted(),
        });
        if (loaded.error) ctx.ui.notify(`Bicameral: keeping previous policy (${loaded.error})`, "error");
        else policy = loaded.policy;
      }
      refreshHud(ctx);
    });

    pi.on("before_agent_start", (event) => {
      if (typeof event.prompt === "string" && event.prompt.trim()) snapshot.userGoal = event.prompt;
      honest.resetPrompt();
    });

    pi.on("message_update", (event, ctx) => {
      const ame = event.assistantMessageEvent;
      if (ame?.type !== "toolcall_end" || !ame.toolCall?.id) return;
      const name = ame.toolCall.name ?? "unknown";
      const args = ame.toolCall.arguments;
      speculator.prefetch(ame.toolCall.id, {
        state: redactSecrets(
          buildGateState({
            userGoal: snapshot.userGoal,
            recentActions: snapshot.recentActions,
            flaggedContent: snapshot.flaggedContent,
            proposedAction: { tool: name, input: args },
          }),
        ),
        questions: packs.gate.questions,
        packHash: packs.gate.packHash,
      });
      void ctx;
    });

    pi.on("tool_call", async (event: ToolCallEvent, ctx: ExtensionContext) => {
      if (!policy.reflexes.gate.enabled) return;
      const result = await evaluateGate({
        backend,
        speculator,
        policy,
        pack: packs.gate,
        toolCall: { id: event.toolCallId, name: event.toolName, arguments: event.input },
        cwd: ctx.cwd,
        snapshot,
        hasUI: ctx.hasUI,
      });
      remember(result.record, ctx, result.action.kind === "allow" ? undefined : true);
      if (policy.mode === "observe") return;
      if (result.action.kind === "confirm" && ctx.hasUI) {
        const ok = await ctx.ui.confirm("Bicameral", result.action.reason ?? "Allow this action?");
        if (!ok) return { block: true, reason: "User declined" };
        return;
      }
      if (result.action.kind === "block") {
        return { block: true, reason: result.action.reason };
      }
      return;
    });

    pi.on("tool_result", async (event: ToolResultEvent, ctx: ExtensionContext) => {
      snapshot.recentActions = [
        ...snapshot.recentActions,
        { tool: event.toolName, error: event.isError },
      ].slice(-20);
      if (!policy.reflexes.honest_finish.enabled) return;
      const path = typeof event.input.path === "string" ? event.input.path : "";
      const looksLikeTestEdit =
        (event.toolName === "edit" || event.toolName === "write") && (isTestPath(path) || path.length > 0);
      if (!looksLikeTestEdit) return;
      const content: TextContent[] = event.content
        .filter((c) => c.type === "text" && typeof c.text === "string")
        .map((c) => ({ type: "text" as const, text: c.text ?? "" }));
      const result = await evaluateHonestFinish({
        backend,
        policy,
        pack: packs.edit_review,
        toolName: event.toolName,
        toolInput: event.input,
        toolResultContent: content,
        snapshot,
        session: honest,
      });
      remember(result.record, ctx, result.action.kind !== "none");
      if (policy.mode === "observe") return;
      if (result.followup && result.followupContent) {
        pi.sendMessage(
          { customType: "bicameral", content: result.followupContent, display: true },
          { deliverAs: "followUp", triggerTurn: true },
        );
      }
      if (result.patchedContent) return { content: result.patchedContent };
      return;
    });

    pi.on("turn_end", async (event: TurnEndEvent, ctx: ExtensionContext) => {
      if (!policy.reflexes.stuck.enabled) return;
      const tr = pickTurnTool(event);
      stuck.record({
        toolName: tr.toolName,
        argsSummary: tr.argsSummary,
        isError: tr.isError,
        errorLine: tr.errorLine,
      });
      const result = await evaluateStuck({
        backend,
        policy,
        pack: packs.progress,
        tracker: stuck,
        snapshot,
      });
      remember(result.record, ctx, result.action.kind !== "none");
      if (policy.mode === "observe") return;
      if (result.action.kind === "steer" && result.hint) {
        pi.sendMessage({ customType: "bicameral", content: result.hint, display: true }, { deliverAs: "steer" });
      }
      if (result.action.kind === "raise_thinking") {
        pi.setThinkingLevel("high");
        if (result.hint) {
          pi.sendMessage({ customType: "bicameral", content: result.hint, display: true }, { deliverAs: "steer" });
        }
      }
    });

    pi.registerCommand("why", {
      description: "Show the nth most recent Bicameral intervention",
      handler: (args, ctx) => {
        const n = Number.parseInt(args.trim(), 10);
        const index = Number.isFinite(n) && n > 0 ? n : 1;
        const interventions = decisions.filter(isIntervention);
        const record = interventions[interventions.length - index];
        const text = record ? formatWhy(record) : "Bicameral: no interventions yet.";
        ctx.ui.notify(text, "info");
      },
    });

    pi.registerCommand("s1", {
      description: "Show System 1 session stats",
      handler: (_args, ctx) => {
        ctx.ui.notify(formatHud(decisions, budget.snapshot(), 5).join("\n"), "info");
      },
    });

    pi.registerEntryRenderer("bicameral.decision", () => undefined);

    function remember(record: BicameralDecision, ctx: ExtensionContext, storeEntry?: boolean): void {
      decisions.push(record);
      budget.record({
        latencyMs: record.latencyMs,
        timeout: record.policyRule.startsWith("degraded"),
        fallback: record.policyRule.startsWith("degraded"),
      });
      if (storeEntry) pi.appendEntry("bicameral.decision", record);
      refreshHud(ctx);
    }

    function refreshHud(ctx: ExtensionContext): void {
      const lines = formatHud(decisions, budget.snapshot(), 5);
      ctx.ui.setWidget("bicameral", lines, { placement: "belowEditor" });
      ctx.ui.setStatus("bicameral", budget.degraded ? "S1 ● degraded" : `S1 ● ${budget.snapshot().p50Ms}ms`);
    }
  };
}

function defaultBackend(): S1Backend {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (apiKey) {
    return new TypeSafeBackend({ apiKey, retry: { maxRetries: 0 } });
  }
  return new UnavailableBackend();
}

function isIntervention(record: BicameralDecision): boolean {
  const kind = actionKind(record.action);
  return kind !== "allow" && kind !== "none";
}

function actionKind(action: unknown): string {
  if (action && typeof action === "object" && "kind" in action) return String((action as { kind: unknown }).kind);
  return "";
}

function pickTurnTool(event: TurnEndEvent): {
  toolName: string;
  argsSummary: string;
  isError: boolean;
  errorLine?: string;
} {
  const results = event.toolResults ?? [];
  const chosen = results.find((r) => r.isError) ?? results[0];
  if (!chosen) {
    return { toolName: "unknown", argsSummary: "", isError: false };
  }
  const input = (chosen.input ?? {}) as Record<string, unknown>;
  const details = (chosen.details ?? {}) as Record<string, unknown>;
  const command =
    (typeof input.command === "string" && input.command) ||
    (typeof details.command === "string" && details.command) ||
    JSON.stringify(input);
  const errorLine = firstTextLine(chosen.content);
  return {
    toolName: chosen.toolName ?? "unknown",
    argsSummary: command,
    isError: Boolean(chosen.isError),
    errorLine,
  };
}

function firstTextLine(content: Array<{ type?: string; text?: string }> | undefined): string | undefined {
  if (!content) return undefined;
  for (const part of content) {
    if (part.type === "text" && typeof part.text === "string" && part.text.trim()) {
      return part.text.split("\n")[0];
    }
  }
  return undefined;
}

export default function bicameral(pi: ExtensionAPI): void {
  createBicameralExtension()(pi);
}

export { FakeBackend, DEFAULT_POLICY };
