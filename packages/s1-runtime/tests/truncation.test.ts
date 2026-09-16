import { describe, expect, it } from "vitest";
import { buildGateState, truncateState, truncateUtf8 } from "../src/index.js";

describe("truncateUtf8", () => {
  it("does not split surrogate pairs", () => {
    const text = "hi 😀👍";
    expect(truncateUtf8(text, 4)).toBe("hi 😀");
    expect(truncateUtf8(text, 5)).toBe("hi 😀👍");
  });

  it("caps at the requested character budget", () => {
    const text = "a".repeat(20_000);
    expect(truncateUtf8(text, 8000).length).toBe(8000);
  });
});

describe("truncateState", () => {
  it("drops low-priority fields first to stay under the default 8k budget", () => {
    const state = truncateState(
      {
        user_goal: { value: "ship the fix", priority: 0 },
        proposed_action: { value: { tool: "bash", command: "ls" }, priority: 1 },
        recent_actions: { value: "x".repeat(20_000), priority: 2 },
      },
      8000,
    );
    const encoded = JSON.stringify(state);
    expect(encoded.length).toBeLessThanOrEqual(8000);
    expect(state.user_goal).toBe("ship the fix");
    expect(state.proposed_action).toEqual({ tool: "bash", command: "ls" });
  });
});

describe("buildGateState", () => {
  it("never includes full file contents and applies the byte budget", () => {
    const state = buildGateState({
      userGoal: "fix tests",
      recentActions: [{ tool: "read", summary: "src/big.ts" }],
      flaggedContent: [],
      proposedAction: {
        tool: "write",
        input: { path: "src/big.ts", content: "line\n".repeat(5000) },
      },
    });
    const json = JSON.stringify(state);
    expect(json.length).toBeLessThanOrEqual(8000);
    expect(json).not.toContain("line\n".repeat(100));
    expect(state).toHaveProperty("proposed_action");
  });
});
