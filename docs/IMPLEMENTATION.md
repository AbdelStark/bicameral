# Implementation notes (v0.1)

## Runtime flow

```
message_update (toolcall_end)
  → buildGateState → redactSecrets → Speculator.prefetch(toolCallId)

tool_call
  → Speculator.take(id, deadline_ms)     # or start late if no prefetch
  → decideGate(answers | "timeout", policy, isHighRiskByPattern)
  → allow | confirm (UI) | block
  → appendEntry("bicameral.decision", record)

tool_result (edit/write)
  → evaluateHonestFinish → patch content at warn; sendMessage followUp at followup
  → HonestFinishSession.followupsThisPrompt caps repeats

turn_end
  → StuckTracker.record
  → identical command+error pre-signal (or every 3 turns) → progress pack
  → steer with a **template** hint (never model-written)
```

Cache: `sha256(packHash + canonical JSON of redacted state)`, TTL 10 minutes. Batch: one backend call with keys `"<toolCallId>.<question>"`.

## Pack format

YAML in `packages/packs/yaml/`. Loader compiles with `@typesafe-ai/sdk` `noul()` / `score()` / `choice()` and sets `packHash` = SHA-256 of canonical JSON `{ pack, version, questions }`. Schema: `packages/packs/schema.json`. Builtins: `gate`, `edit_review`, `finish_check`, `progress`.

## Degraded mode

If `take` returns `"timeout"` or the backend throws:

- `isHighRiskByPattern` (network tools/commands, package installs, `git push`, recursive `rm`, paths outside `cwd`) → confirm, or block when headless (`headless_confirm_as: block`)
- otherwise allow

No `TYPESAFE_API_KEY` → `UnavailableBackend` (immediate error → same fallback). Daily `budget.s1_daily_usd` marks the HUD degraded.

## Policy

Global `~/<CONFIG_DIR_NAME>/agent/bicameral.yaml` merged under project `<cwd>/<CONFIG_DIR_NAME>/bicameral.yaml` only if `ctx.isProjectTrusted()`. Invalid YAML keeps the previous policy (`PolicyStore`). Example: `examples/bicameral.yaml`.

## What is wired into Pi

`packages/pi-bicameral` default export is an `ExtensionAPI` factory:

| Hook / API | Use |
|---|---|
| `session_start` | load policy, HUD |
| `message_update` | speculative gate prefetch |
| `tool_call` | Gate block/confirm |
| `tool_result` | Honest Finish warn/follow-up |
| `turn_end` | Stuck steer |
| `before_agent_start` | snapshot goal, reset follow-up counter |
| `registerCommand("why")` | `formatWhy` on last intervention |
| `registerCommand("s1")` | HUD stats |
| `ctx.ui.setWidget(..., { placement: "belowEditor" })` | HUD lines |
| `appendEntry("bicameral.decision")` | audit (not LLM context) |

Not shipped: R4–R8, `bicameral-cli`, LLM backend (stub `LlmBackend` only), live Jev in tests, benchmarks.

## Pi 0.85.1 vs SPEC

Types were read from `@earendil-works/pi-coding-agent@0.85.1` (`ExtensionAPI` in `dist/core/extensions/types.d.ts`). Deltas:

- Hook names match SPEC (`tool_call`, `tool_result`, `message_update` / `toolcall_end`, `turn_end`, `setThinkingLevel`, `sendMessage({ deliverAs: "steer" \| "followUp" })`, `CONFIG_DIR_NAME`, `isProjectTrusted`).
- `ctx.ui.setWidget` accepts `string[]` **or** a TUI component factory. v0.1 uses `string[]` (SPEC's "renderFn" is the factory overload).
- The extension compiles against a thin local `pi-types.ts` with those names so `pnpm test` does not require Pi's native image/TUI deps. Pi remains an optional peer at **0.85.1**.

TypeSafe: `TypeSafeBackend` wraps `TypeSafeClient.systemOne` (`@typesafe-ai/sdk` **0.6.0**) with `retry: { maxRetries: 0 }`. Tests inject `fetch`; they never call `api.typesafe.ai`.
