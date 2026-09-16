# Bicameral — agent notes

Community project, private until launch. Read `PRD.md` and `SPEC.md` before changing behavior. Do not add TypeSafe job-hunt or campaign material.

## Commands

```bash
pnpm install          # workspace install (Node 20+)
pnpm test             # vitest, no network
pnpm typecheck        # tsc -p per package
pnpm --filter @bicameral/s1-runtime test   # not needed; root `pnpm test` covers all
```

Pin: Pi `@earendil-works/pi-coding-agent` **0.85.1**. TypeSafe SDK `@typesafe-ai/sdk` **0.6.0**.

## Packages

| Package | Role |
|---|---|
| `@bicameral/packs` | YAML judgment packs + loader (`noul`/`score`/`choice` + `packHash`) |
| `@bicameral/s1-runtime` | Backends, cache, speculator, redaction, policy, `decide*` / `evaluate*` |
| `pi-bicameral` | Pi extension wiring R1–R3, HUD, `/why` |

## Adding a reflex (v0.1 pattern)

1. Add a YAML pack under `packages/packs/yaml/` and load it from `loadBuiltinPacks()`.
2. Put the **pure** decision function in `packages/s1-runtime/src/decisions/` (`decideX`). Tests must import that function, not reimplement thresholds.
3. Add `evaluateX` that: build state → redact → `Speculator.take` → `decideX` → `BicameralDecision`.
4. Add a policy section in `DEFAULT_POLICY` / `examples/bicameral.yaml`.
5. Wire a Pi hook in `packages/pi-bicameral/src/index.ts`. System 1 never generates text; hints are templates.
6. Tests use `FakeBackend` scripted probabilities. Do not call the live TypeSafe API.

## Tests

`pnpm test` must stay green offline. FakeBackend is System 1. Decision math lives in shipped modules.

## Pi

`pi-bicameral` is a Pi package (`pi.extensions: ./src/index.ts`). Peer: `@earendil-works/pi-coding-agent` 0.85.1 (optional so unit tests do not need native TUI deps). Hook names match 0.85.1: `tool_call`, `tool_result`, `message_update`, `turn_end`, `before_agent_start`, `session_start`. Use `CONFIG_DIR_NAME` (fallback `.pi`). Honor `ctx.isProjectTrusted()` before project-local policy.
