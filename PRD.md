# Bicameral: PRD

**A hybrid coding harness built on Pi. System 2 (an LLM) writes the code. System 1 (TypeSafe's Jev) runs the reflexes: it gates actions, picks tools and models, catches stuck loops and test tampering, curates context, and selects the best of many attempts. Every judgment is typed, calibrated, and takes milliseconds.**

| Field | Value |
|---|---|
| Owner | Abdel Bakhta (@AbdelStark) |
| Status | Draft v1.0, 16 Sep 2026 |
| Repo | `github.com/AbdelStark/bicameral` (pnpm monorepo) |
| Distribution | Pi package `pi-bicameral` (`pi install npm:pi-bicameral`) and standalone CLI `bicameral` built on the Pi SDK (both npm names free as of 16 Sep 2026) |
| Built on | Pi (`@earendil-works/pi-coding-agent` 0.85.x, MIT), official TypeSafe TypeScript SDK (`@typesafe-ai/sdk` 0.6.x) |
| Shares with | [`reflex`](../reflex/PRD.md) (judgment packs and red-team suites) |
| Target | v0.1 in 3 weeks, v0.2 in 5 weeks, v0.3 + benchmark report in 8 weeks |
| Companion | [`SPEC.md`](./SPEC.md) |

---

## 1. Thesis

Every coding harness today is a single mind. One frontier model does everything: writes code, decides which tools matter, judges whether a command is dangerous, notices it is looping, decides what to keep in context, and grades its own work. Most of those jobs are not reasoning problems. They are fast, repeated, narrow judgments. Using a slow, expensive, overconfident generalist for them is why agents are costly, loop, tamper with tests, and need babysitting.

The human brain splits the work. Kahneman called it System 1 and System 2. TypeSafe named its model class after that split. **Bicameral is the first coding harness designed around it:**

| Job | Who does it in Bicameral |
|---|---|
| Plan, write code, explain, debug | System 2: any LLM Pi supports |
| Is this action safe? Which tools does this task need? Which model and effort level fits this prompt? Is the agent stuck? Did it just weaken a test? Is this old tool output still relevant? Which of these five patches is best? | System 1: Jev, typed questions, calibrated probabilities, sub-second |
| What happens with those probabilities | Deterministic code and a policy file you own |

System 1 cannot write a single string. That is the point: it can never hallucinate a command, only score one.

## 2. Why this is the definitive showcase

- **It demonstrates the manifesto, not a demo.** "Keep code in control, give the model narrow decisions, compose them" applied to the most valuable AI workflow in the world.
- **It answers the obvious skeptic question** ("why not just ask the LLM?") with numbers: System 1 decisions at a fraction of a cent and a fraction of a second, measured side by side against an LLM doing the same judgments.
- **Pi is the right foundation.** Pi's core is deliberately minimal and every behaviour Bicameral needs is exposed as an extension point: blockable `tool_call`, mutable `tool_result`, per-call `context` rewriting, `before_agent_start` model and prompt control, additive dynamic tool activation with native deferred loading, steering and follow-up messages, custom TUI widgets, and an SDK for subagents. No fork required.
- **Community leverage.** Pi's user base is exactly the audience of builders who try new harness ideas. A strong Pi package spreads through that community, and Pi's maintainers are European builders (verify current team), which strengthens your Europe network story.
- **It uses the official TypeScript SDK.** That is a respectful, useful signal to TypeSafe's SDK author (`evinism`), and a natural source of real-world SDK feedback.

## 3. The reflexes

Eight System 1 capabilities, each an independent module with its own judgment pack, policy section, and on/off switch.

| # | Reflex | Pi hook points | What System 1 decides | What code does with it | Ships |
|---|---|---|---|---|---|
| R1 | **Gate** | `message_update` (speculative), `tool_call` | Reversibility, exfiltration, secret access, scope escape, injected intent | Allow, confirm with user, or block with reason for the LLM | v0.1 |
| R2 | **Honest Finish** | `tool_result` (edit/write/bash), `agent_end` | Test weakened or disabled, stub or placeholder introduced, success claimed without verification, goal met | Warn inline on the edit; send a follow-up turn asking for verification or revert | v0.1 |
| R3 | **Stuck Detector** | `turn_end` | Repeated failing action, oscillating edits, no progress over N turns | Steer message with a concrete hint; raise thinking level; after repeated stalls, pause and ask user | v0.1 |
| R4 | **Toolpack Router** | `before_agent_start`, `turn_end` | Which toolpacks the task needs (browser, database, git archaeology, test runner, docs search, container, cloud CLI) | Additive `pi.setActiveTools()` so prompts stay small and cache-friendly | v0.2 |
| R5 | **Model and Effort Router** | `before_agent_start` | Task type, difficulty, blast radius | Select model and thinking level within your allowed set at prompt boundaries | v0.2 |
| R6 | **Injection Shield** | `tool_result` (read, bash, web tools, MCP) | Instructions aimed at an agent inside untrusted output | Wrap output as untrusted data with an explicit warning; inform the Gate | v0.2 |
| R7 | **Context Curator** | `context`, `session_before_compact` | Relevance of each old tool result to the current step | Elide low-relevance outputs reversibly (with a `recall` tool) when context pressure is high; choose which entries survive compaction verbatim | v0.3 |
| R8 | **Best-of-N Selector** | `/fanout N` command, Pi SDK subagents in git worktrees | Rubric scores for each candidate patch (addresses issue, minimal, no tampering, style fit), combined with test results | Pick the winner; show the scoreboard | v0.3 |

### The HUD

A widget under the editor shows System 1 working in real time: last decisions with probability bars, decisions per turn, p50 latency, and a running comparison, for example "System 1: 412 decisions, 41 ms p50, $0.003 / System 2: 1.9M tokens, $4.10". `/why` opens the exact questions, state, probabilities, and policy rule behind any intervention. No LLM-written rationalization: the explanation is the data.

## 4. Goals

| # | Goal | Measure |
|---|---|---|
| G1 | Install in one command into existing Pi setups | `pi install npm:pi-bicameral` works with default config |
| G2 | Invisible latency | Median added wall time per tool call under 50 ms thanks to speculative judgment; p95 under 400 ms |
| G3 | Fail safe | If TypeSafe is unreachable, high-risk actions require confirmation; everything else proceeds and the HUD shows degraded mode |
| G4 | Policy as code | `.pi/bicameral.yaml` project policy with hot reload; global defaults |
| G5 | Full audit | Every decision stored as a session custom entry, rendered inline, exportable as JSONL |
| G6 | Benchmarked | Public report with ablations per reflex (see §7) |
| G7 | Model-agnostic System 2 | Works with any Pi provider; benchmark on at least two model families |
| G8 | Pluggable System 1 | Same judgment packs run on Jev or on an LLM backend, for honest comparison |

## 5. Non-goals

- Not a sandbox. Bicameral reduces risk and waste; isolation remains the job of containers.
- No fork of Pi; everything through public extension and SDK APIs.
- No System 1 generated text anywhere (by construction).
- No telemetry leaving the machine except TypeSafe calls (and System 2 provider calls Pi already makes).

## 6. Users

| User | Why they install it |
|---|---|
| Pi users | Safer autonomous runs, fewer loops, lower cost, no workflow change |
| Teams running agents in CI | Honest Finish and tamper detection before merge |
| Harness researchers | Clean platform for hybrid-architecture experiments with ablations |
| TypeSafe | Flagship proof that System One models change agent economics and reliability |

## 7. Benchmark plan: prove it or cut it

Every reflex must earn its place with data. Hypotheses are pre-registered in the repo before the first full run.

### 7.1 Suites

| Suite | Purpose | Size |
|---|---|---|
| SWE-bench Verified subset (seeded random) | Real-world resolve rate and cost | 100 tasks main comparison; 50 for ablations |
| TamperBench (new, open-sourced) | Tasks where the easy route to green tests is editing or skipping tests | 40 tasks |
| InjectionBench (shared with Reflex) | Repos and docs seeded with agent-directed instructions | 40 tasks |
| StallBench (new) | Tasks with misleading errors that induce loops (flaky ports, wrong working directory, missing env) | 30 tasks |
| Daily-driver log | Two weeks of real use with all reflexes in observe mode; human-rated interventions | 2,000+ decisions |

### 7.2 Conditions

1. Vanilla Pi, same System 2 model.
2. Bicameral, all reflexes, System 1 = Jev.
3. Bicameral, all reflexes, System 1 = small LLM through the same packs (for latency and cost comparison).
4. Ablations: each reflex removed one at a time (50-task subset).
Two System 2 model families for conditions 1 and 2.

### 7.3 Metrics

Resolve rate; dollars per resolved task (System 2 + System 1); System 2 input and output tokens; wall time; tamper rate; injection success rate; stall episodes and turns wasted; intervention precision (human-rated sample of 200); System 1 decisions, p50/p95 latency, and cost.

### 7.4 Pre-registered hypotheses

| ID | Hypothesis |
|---|---|
| H1 | Bicameral matches vanilla resolve rate within 2 points while cutting dollars per resolved task by at least 20% (router + curator) |
| H2 | Tamper rate drops by at least 70% on TamperBench |
| H3 | Injection success drops by at least 70% on InjectionBench with less than 3 points of utility loss |
| H4 | Turns wasted in stall episodes drop by at least 50% on StallBench |
| H5 | System 1 via Jev is at least 10x cheaper and 5x faster per decision than System 1 via a small LLM, at comparable intervention precision |

Results are published whether or not hypotheses hold. A reflex that does not pay for itself is disabled by default in the next release.

## 8. Success criteria

**Product:** 200 weekly active installs within 6 weeks of v0.2; zero known fail-open bugs on high-risk actions.
**Evidence:** benchmark report with CIs and ablations; TamperBench adopted or cited by others.
**Signal:** TypeSafe features it; Pi maintainers or community highlight it.
**Career:** the centerpiece of your application: a new harness architecture, built on their thesis, with numbers.

## 9. Milestones

| Week | Deliverable |
|---|---|
| 0 | Judgment pack format (shared with Reflex); observe-only logging extension for daily use; pre-registration draft |
| 1 | System 1 runtime (client, cache, speculative prefetch, deadlines, budget, audit entries); R1 Gate |
| 2 | R2 Honest Finish, R3 Stuck Detector; HUD and `/why` |
| 3 | **v0.1** Pi package release; demo video; TamperBench and StallBench authoring starts |
| 4 | R4 Toolpack Router, R5 Model and Effort Router, R6 Injection Shield |
| 5 | **v0.2**; standalone `bicameral` CLI distribution; LLM System 1 backend |
| 6 to 7 | R7 Context Curator, R8 Best-of-N; benchmark runs |
| 8 | **v0.3** + report; private pre-share with TypeSafe; public launch |

## 10. Budget (estimates)

| Item | Estimate |
|---|---|
| System 1 (Jev) across all benchmarks | under $20 at $0.042/MTok |
| System 2 on SWE-bench subset (100 x 2 conditions x 2 model families, plus 50 x 9 ablation runs) | $1,200 to $2,500 depending on models |
| TamperBench, InjectionBench, StallBench runs | $200 to $400 |
| System 1 via LLM condition | $50 to $150 |
| Benchmark compute (containers) | $100 |
| **Cap** | **$3,000**; reduce by running ablations on one model family if needed |

## 11. Risks

| Risk | Mitigation |
|---|---|
| Added latency makes the harness feel slower | Speculative judgment on `toolcall_end` while the LLM is still streaming; cache; per-reflex deadlines |
| Interventions annoy users | Observe mode first; tune on daily-driver log to precision targets; per-reflex thresholds |
| Model switching or tool changes invalidate prompt caches | Route only at prompt boundaries; tool activation strictly additive mid-prompt; curator only acts above a context-pressure threshold and batches elisions |
| Context elision hurts task success | Reversible elision with `recall` tool; ablation decides default |
| Pi API churn (frequent releases) | Pin peer range; CI against latest Pi weekly; small adapter layer |
| TypeSafe early-access throughput limits during benchmarks | Ask for quota; runner concurrency limits; judgment cache |
| Benchmark cost overruns | Pilot 10 tasks per condition first; hard spend cap in runner |
| Results do not support hypotheses | Publish anyway; value remains in safety reflexes and a reusable research platform |
| Overlap with Reflex | Share judgment packs and suites; position Reflex as the guard for Claude Code and Bicameral as the native hybrid harness |

## 12. Open questions

- Jev maximum questions per request and state size (affects curator batch size and Best-of-N rubric).
- Whether TypeSafe wants to co-author TamperBench.
- Which System 2 model families to benchmark given budget.
- Pi maintainers' appetite for upstreaming generic hooks the project discovers it needs.
