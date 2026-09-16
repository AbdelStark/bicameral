# Bicameral

A hybrid coding harness built on [Pi](https://pi.dev). **System 2** (an LLM) writes the code. **System 1** (TypeSafe Jev, or a fake backend in tests) runs the reflexes: it gates actions, catches test tampering, and steers stuck loops. Judgments are typed probabilities. Code and a policy file decide what happens.

**This is not a sandbox.** Bicameral reduces risk and waste; isolation is still the job of containers. System 1 never generates commands or prose — only scores.

| | |
|---|---|
| Version | 0.1.0 |
| Pi | `@earendil-works/pi-coding-agent` 0.85.1 |
| TypeSafe SDK | `@typesafe-ai/sdk` 0.6.0 |
| License | MIT |

- [PRD](./PRD.md) · [SPEC](./SPEC.md) · [Implementation](./docs/IMPLEMENTATION.md) · [Roadmap](./ROADMAP.md)

## Install (Pi)

The npm name may be private until launch. When the package is published:

```bash
pi install npm:pi-bicameral
```

From this repo (trusted project):

```bash
pnpm install
# then point Pi at the local package, for example:
pi install /absolute/path/to/bicameral/packages/pi-bicameral
```

Set `TYPESAFE_API_KEY` for live Jev. Without a key, Bicameral runs in **degraded mode**: high-risk patterns confirm/block, everything else proceeds.

Copy [`examples/bicameral.yaml`](./examples/bicameral.yaml) to `~/.pi/agent/bicameral.yaml` and, for a trusted project, `.pi/bicameral.yaml`.

## Data flow

```
Pi session (tool call, edit, turn)
        │
        ▼
  state builder (truncated, 8k)
        │
        ▼
  redaction  ── secrets, JWTs, private keys, high-entropy assignments
        │         become <REDACTED:kind>
        ▼
  TypeSafe POST /v1/systemone     (state + named questions only)
        │
        ▼
  probabilities → policy YAML → allow / confirm / block / warn / steer
        │
        ▼
  audit entry bicameral.decision (not sent to the LLM)
```

**Sent to TypeSafe:** redacted, truncated JSON state for the current reflex (goal, proposed tool, compact diffs, recent action summaries) and the pack's questions.

**Not sent:** raw file contents, unredacted secrets, full session transcripts, policy files, API keys for other providers.

**Stays local:** decisions, HUD, `/why`, Pi session log.

## Tests

```bash
pnpm test        # vitest, offline, FakeBackend as System 1
pnpm typecheck
```

Requires Node 20+ and pnpm. Tests do not call the TypeSafe API.

## Packages

- `@bicameral/packs` — YAML judgment packs
- `@bicameral/s1-runtime` — backends, speculator, Gate / Honest Finish / Stuck
- `pi-bicameral` — Pi extension
