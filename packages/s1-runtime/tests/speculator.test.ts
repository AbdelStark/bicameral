import { noul } from "@typesafe-ai/sdk";
import { describe, expect, it } from "vitest";
import { FakeBackend, Speculator } from "../src/index.js";

describe("Speculator", () => {
  it("returns the prefetched result when it completes before take", async () => {
    const backend = new FakeBackend({ noul: { a: 0.7 }, delayMs: 25 });
    const spec = new Speculator(backend);
    spec.prefetch("t1", { state: { k: 1 }, questions: { a: noul("A?") } });
    const res = await spec.take("t1", 1000);
    expect(res).not.toBe("timeout");
    if (res === "timeout") throw new Error("unreachable");
    expect(res.answers.a).toMatchObject({ type: "noul", noul: 0.7 });
  });

  it("returns timeout when take deadline elapses first", async () => {
    const backend = new FakeBackend({ noul: { a: 0.7 }, delayMs: 250 });
    const spec = new Speculator(backend);
    spec.prefetch("t1", { state: {}, questions: { a: noul("A?") } });
    const res = await spec.take("t1", 20);
    expect(res).toBe("timeout");
  });

  it("batches multiple tool calls with namespaced question keys", async () => {
    const seenKeys: string[] = [];
    const backend = new FakeBackend({
      noul: { "c1.exfiltration": 0.1, "c2.exfiltration": 0.9 },
      onDecide: (req) => {
        seenKeys.push(...Object.keys(req.questions));
      },
    });
    const spec = new Speculator(backend);
    spec.prefetchBatch(
      [
        { id: "c1", questions: { exfiltration: noul("e") } },
        { id: "c2", questions: { exfiltration: noul("e") } },
      ],
      { state: { goal: "x" } },
    );
    const r1 = await spec.take("c1", 1000);
    const r2 = await spec.take("c2", 1000);
    expect(seenKeys.sort()).toEqual(["c1.exfiltration", "c2.exfiltration"]);
    expect(r1).not.toBe("timeout");
    expect(r2).not.toBe("timeout");
    if (r1 === "timeout" || r2 === "timeout") throw new Error("unreachable");
    expect(r1.answers.exfiltration).toMatchObject({ noul: 0.1 });
    expect(r2.answers.exfiltration).toMatchObject({ noul: 0.9 });
  });
});
