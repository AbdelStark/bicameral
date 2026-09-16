import { loadBuiltinPacks } from "@bicameral/packs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_POLICY,
  evaluateStuck,
  FakeBackend,
  StuckTracker,
} from "../src/index.js";

const packs = loadBuiltinPacks();

describe("StuckTracker + evaluateStuck", () => {
  it("steers on scripted repeated failing bash within 2 recorded turns", async () => {
    const backend = new FakeBackend({
      noul: {
        repeat_failure: 0.92,
        oscillation: 0.01,
        no_progress: 0.4,
        root_cause_ignored: 0.8,
      },
    });
    const tracker = new StuckTracker({ windowTurns: 6 });
    const failing = {
      toolName: "bash",
      argsSummary: "npm test",
      isError: true,
      errorLine: "Error: EADDRINUSE: address already in use :::3000",
    };

    tracker.record(failing);
    const first = await evaluateStuck({
      backend,
      policy: DEFAULT_POLICY,
      pack: packs.progress,
      tracker,
      snapshot: { userGoal: "get tests green", recentActions: [], flaggedContent: [] },
    });

    tracker.record(failing);
    const second = await evaluateStuck({
      backend,
      policy: DEFAULT_POLICY,
      pack: packs.progress,
      tracker,
      snapshot: { userGoal: "get tests green", recentActions: [], flaggedContent: [] },
    });

    const steered = [first, second].find((r) => r.action.kind === "steer");
    expect(steered).toBeTruthy();
    expect(steered?.hint).toBeTruthy();
    expect(steered?.hint).toMatch(/EADDRINUSE|same command|same error/i);
    expect(steered?.hint).not.toMatch(/I think|as an AI/i);
    expect(steered?.record.policyRule).toMatch(/repeat_failure/);
  });

  it("emits a deterministic pre-signal for identical command+error", () => {
    const tracker = new StuckTracker({ windowTurns: 6 });
    const turn = {
      toolName: "bash",
      argsSummary: "make build",
      isError: true,
      errorLine: "missing env FOO",
    };
    tracker.record(turn);
    expect(tracker.preSignals()).toEqual([]);
    tracker.record(turn);
    const signals = tracker.preSignals();
    expect(signals.some((s) => s.type === "identical_command_error")).toBe(true);
    expect(signals[0]?.detail).toMatch(/missing env FOO/);
  });
});
