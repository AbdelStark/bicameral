import { loadBuiltinPacks } from "@bicameral/packs";
import { describe, expect, it } from "vitest";
import {
  decideHonestFinish,
  DEFAULT_POLICY,
  evaluateHonestFinish,
  FakeBackend,
  HonestFinishSession,
} from "../src/index.js";

const packs = loadBuiltinPacks();

describe("decideHonestFinish", () => {
  it("warns and follow-ups a scripted test-weakening edit", () => {
    const decision = decideHonestFinish({
      answers: {
        test_weakened: { type: "noul", noul: 0.82 },
        stub_introduced: { type: "noul", noul: 0.1 },
      },
      policy: DEFAULT_POLICY,
      followupsThisPrompt: 0,
    });
    expect(decision.warn).toBe(true);
    expect(decision.followup).toBe(true);
    expect(decision.warningText).toMatch(/weaken/i);
    expect(decision.warningText).toMatch(/0\.82/);
    expect(decision.followupContent).toMatch(/test/i);
    expect(decision.policyRule).toMatch(/test_weakened/);
  });

  it("does not follow up after the per-prompt counter is exhausted", () => {
    const policy = {
      ...DEFAULT_POLICY,
      reflexes: {
        ...DEFAULT_POLICY.reflexes,
        honest_finish: {
          ...DEFAULT_POLICY.reflexes.honest_finish,
          max_followups_per_prompt: 1,
        },
      },
    };
    const first = decideHonestFinish({
      answers: { test_weakened: { type: "noul", noul: 0.9 } },
      policy,
      followupsThisPrompt: 0,
    });
    expect(first.followup).toBe(true);
    const second = decideHonestFinish({
      answers: { test_weakened: { type: "noul", noul: 0.9 } },
      policy,
      followupsThisPrompt: 1,
    });
    expect(second.followup).toBe(false);
    expect(second.warn).toBe(true);
  });
});

describe("evaluateHonestFinish", () => {
  it("returns patched content and exactly one follow-up when over the followup threshold", async () => {
    const backend = new FakeBackend({
      noul: { test_weakened: 0.82, stub_introduced: 0.05 },
      score: { edit_matches_goal: { score: 1, confidence: 0.6 } },
    });
    const session = new HonestFinishSession();
    const original = [{ type: "text" as const, text: "edited tests/test_totals.py" }];
    const first = await evaluateHonestFinish({
      backend,
      policy: {
        ...DEFAULT_POLICY,
        reflexes: {
          ...DEFAULT_POLICY.reflexes,
          honest_finish: {
            ...DEFAULT_POLICY.reflexes.honest_finish,
            max_followups_per_prompt: 1,
          },
        },
      },
      pack: packs.edit_review,
      toolName: "edit",
      toolInput: {
        path: "tests/test_totals.py",
        edits: [{ oldText: "assert total == 3", newText: "assert True" }],
      },
      toolResultContent: original,
      snapshot: { userGoal: "fix rounding", recentActions: [], flaggedContent: [] },
      session,
    });
    expect(first.followup).toBe(true);
    expect(first.patchedContent?.some((c) => /weaken/i.test(c.text))).toBe(true);
    expect(first.record.action).toMatchObject({ kind: expect.stringMatching(/followup|warn/) });

    const second = await evaluateHonestFinish({
      backend,
      policy: {
        ...DEFAULT_POLICY,
        reflexes: {
          ...DEFAULT_POLICY.reflexes,
          honest_finish: {
            ...DEFAULT_POLICY.reflexes.honest_finish,
            max_followups_per_prompt: 1,
          },
        },
      },
      pack: packs.edit_review,
      toolName: "edit",
      toolInput: {
        path: "tests/test_totals.py",
        edits: [{ oldText: "assert total == 3", newText: "pass" }],
      },
      toolResultContent: original,
      snapshot: { userGoal: "fix rounding", recentActions: [], flaggedContent: [] },
      session,
    });
    expect(second.followup).toBe(false);
    expect(session.followupsThisPrompt).toBe(1);
  });
});
