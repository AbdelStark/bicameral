import { noul } from "@typesafe-ai/sdk";
import { describe, expect, it } from "vitest";
import { TypeSafeBackend } from "../src/index.js";

describe("TypeSafeBackend", () => {
  it("POSTs /v1/systemone through the SDK and does not hit the live API", async () => {
    const fetchFn = async (input: string, init?: RequestInit): Promise<Response> => {
      expect(String(input)).toMatch(/\/v1\/systemone$/);
      expect(init?.method).toBe("POST");
      const body = JSON.parse(String(init?.body));
      expect(body.questions.billing.type).toBe("noul");
      return new Response(
        JSON.stringify({
          model: "jev-latest",
          answers: { billing: { type: "noul", noul: 0.9 } },
          usage: { input_tokens: 10, output_tokens: 2 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const backend = new TypeSafeBackend({
      apiKey: "sk-test",
      baseURL: "http://typesafe.test",
      fetch: fetchFn,
      timeout: 1000,
      retry: { maxRetries: 0 },
    });
    const result = await backend.decide(
      { state: "I was charged twice", questions: { billing: noul("Is this about billing?") } },
      { signal: new AbortController().signal, timeoutMs: 1000 },
    );
    expect(backend.name).toMatch(/typesafe/);
    expect(result.answers.billing).toMatchObject({ type: "noul", noul: 0.9 });
  });
});
