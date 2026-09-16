/**
 * Thin ExtensionAPI matching Pi 0.85.1 hook names used by v0.1.
 * Sourced from `@earendil-works/pi-coding-agent` 0.85.1 `dist/core/extensions/types.d.ts`.
 * Pi is an optional peer so tests do not load native TUI/image deps.
 */

export type ExtensionMode = "tui" | "rpc" | "json" | "print";

export interface ExtensionUIContext {
  select(title: string, options: string[]): Promise<string | undefined>;
  confirm(title: string, message: string): Promise<boolean>;
  notify(message: string, type?: "info" | "warning" | "error"): void;
  setStatus(key: string, text: string | undefined): void;
  setWidget(
    key: string,
    content: string[] | undefined,
    options?: { placement?: "aboveEditor" | "belowEditor" },
  ): void;
}

export interface ExtensionContext {
  ui: ExtensionUIContext;
  mode: ExtensionMode;
  hasUI: boolean;
  cwd: string;
  signal?: AbortSignal;
  isProjectTrusted(): boolean;
  abort?: () => void;
}

export interface ExtensionCommandContext extends ExtensionContext {}

export interface ToolCallEvent {
  type: "tool_call";
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
}

export interface ToolCallEventResult {
  block?: boolean;
  reason?: string;
  terminate?: boolean;
}

export interface ToolResultContent {
  type: "text" | "image";
  text?: string;
}

export interface ToolResultEvent {
  type: "tool_result";
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
  content: ToolResultContent[];
  isError: boolean;
  details?: unknown;
}

export interface ToolResultEventResult {
  content?: ToolResultContent[];
}

export interface TurnEndEvent {
  type: "turn_end";
  turnIndex: number;
  message: unknown;
  toolResults: Array<{
    toolName?: string;
    toolCallId?: string;
    isError?: boolean;
    content?: ToolResultContent[];
    details?: unknown;
    input?: Record<string, unknown>;
  }>;
}

export interface MessageUpdateEvent {
  type: "message_update";
  message: unknown;
  assistantMessageEvent?: {
    type?: string;
    toolCall?: { id?: string; name?: string; arguments?: unknown };
  };
}

export interface BeforeAgentStartEvent {
  type: "before_agent_start";
  prompt?: string;
}

export interface SessionStartEvent {
  type: "session_start";
  reason: string;
}

export interface AgentEndEvent {
  type: "agent_end";
  messages?: unknown[];
}

export interface ExtensionAPI {
  on(event: "session_start", handler: (event: SessionStartEvent, ctx: ExtensionContext) => unknown): void;
  on(event: "before_agent_start", handler: (event: BeforeAgentStartEvent, ctx: ExtensionContext) => unknown): void;
  on(event: "message_update", handler: (event: MessageUpdateEvent, ctx: ExtensionContext) => unknown): void;
  on(
    event: "tool_call",
    handler: (event: ToolCallEvent, ctx: ExtensionContext) => Promise<ToolCallEventResult | void> | ToolCallEventResult | void,
  ): void;
  on(
    event: "tool_result",
    handler: (event: ToolResultEvent, ctx: ExtensionContext) => Promise<ToolResultEventResult | void> | ToolResultEventResult | void,
  ): void;
  on(event: "turn_end", handler: (event: TurnEndEvent, ctx: ExtensionContext) => unknown): void;
  on(event: "agent_end", handler: (event: AgentEndEvent, ctx: ExtensionContext) => unknown): void;
  on(event: string, handler: (event: never, ctx: ExtensionContext) => unknown): void;
  registerCommand(
    name: string,
    options: {
      description?: string;
      handler: (args: string, ctx: ExtensionCommandContext) => Promise<void> | void;
    },
  ): void;
  registerEntryRenderer(customType: string, renderer: unknown): void;
  sendMessage(
    message: { customType: string; content: string; display?: boolean },
    options?: { triggerTurn?: boolean; deliverAs?: "steer" | "followUp" | "nextTurn" },
  ): void;
  appendEntry(customType: string, data?: unknown): void;
  setThinkingLevel(level: string): void;
  getThinkingLevel(): string;
  getActiveTools(): string[];
  setActiveTools(toolNames: string[]): void;
}

export const FALLBACK_CONFIG_DIR_NAME = ".pi";
