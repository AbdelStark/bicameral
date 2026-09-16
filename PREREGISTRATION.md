# Pre-registration (stub)

Hypotheses are defined in [`PRD.md`](./PRD.md) §7.4. This file exists so they are checked in **before** any benchmark run. v0.1 does not run benches.

| ID | Hypothesis (from PRD) |
|---|---|
| H1 | Bicameral matches vanilla resolve rate within 2 points while cutting dollars per resolved task by at least 20% (router + curator) |
| H2 | Tamper rate drops by at least 70% on TamperBench |
| H3 | Injection success drops by at least 70% on InjectionBench with less than 3 points of utility loss |
| H4 | Turns wasted in stall episodes drop by at least 50% on StallBench |
| H5 | System 1 via Jev is at least 10x cheaper and 5x faster per decision than System 1 via a small LLM, at comparable intervention precision |

Do not run SWE-bench, TamperBench, or StallBench in v0.1. Fill in suite SHAs, model IDs, seeds, and spend caps here before the first full run.
