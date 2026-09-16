import { describe, expect, it } from "vitest";
import { redactSecrets } from "../src/index.js";

describe("redactSecrets", () => {
  it("redacts JWTs", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.signaturepart";
    const out = redactSecrets(`Authorization: Bearer ${jwt}`);
    expect(out).toContain("<REDACTED:jwt>");
    expect(out).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
  });

  it("redacts private key blocks", () => {
    const pem = `-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0Z3examplekeymaterial\n-----END RSA PRIVATE KEY-----`;
    const out = redactSecrets(pem);
    expect(out).toContain("<REDACTED:private_key>");
    expect(out).not.toContain("BEGIN RSA PRIVATE KEY");
  });

  it("redacts key assignments and AWS-style keys", () => {
    const text = [
      'api_key = "sk-live-abcdefghijklmnopqrstuvwxyz012345"',
      "AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      "AKIAIOSFODNN7EXAMPLE",
    ].join("\n");
    const out = redactSecrets(text);
    expect(out).toMatch(/<REDACTED:(secret|aws_key|high_entropy)>/);
    expect(out).not.toContain("sk-live-abcdefghijklmnopqrstuvwxyz012345");
    expect(out).not.toContain("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    expect(out).not.toContain("AKIAIOSFODNN7EXAMPLE");
  });

  it("redacts high-entropy assignments", () => {
    const token = "p7Qx9mK2vL8nR4sT6wY1zA3bC5dE0fG";
    const out = redactSecrets(`token=${token}`);
    expect(out).toContain("<REDACTED:");
    expect(out).not.toContain(token);
  });

  it("walks nested objects and leaves ordinary prose", () => {
    const input = {
      goal: "fix the rounding bug in totals",
      secret: "password=hunter2hunter2hunter2",
    };
    const out = redactSecrets(input) as { goal: string; secret: string };
    expect(out.goal).toBe("fix the rounding bug in totals");
    expect(out.secret).toMatch(/<REDACTED:/);
  });
});
