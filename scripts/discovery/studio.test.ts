import { describe, it, expect } from "vitest";
import {
  normalizeDoc,
  renderDoc,
  plainDoc,
  validateResult,
  answerMetrics,
  roleInstructions,
} from "../../supabase/functions/_shared/studio-core";
describe("Studio safety boundaries", () => {
  it("escapes HTML and rejects executable links", () => {
    expect(renderDoc(plainDoc("<script>alert(1)</script>"))).not.toContain(
      "<script>",
    );
    expect(() =>
      normalizeDoc({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "click",
                marks: [
                  { type: "link", attrs: { href: "javascript:alert(1)" } },
                ],
              },
            ],
          },
        ],
      }),
    ).toThrow();
  });
  it("rejects offsite image and strips unsupported nodes", () => {
    expect(() =>
      normalizeDoc({
        type: "doc",
        content: [
          { type: "image", attrs: { src: "https://evil.example/x", alt: "x" } },
        ],
      }),
    ).toThrow();
  });
  it("rejects branded prompts, duplicate questions and missing evidence", () => {
    const p = {
      text: "Which whiteboard helps a team plan?",
      sources: ["https://example.org/discussion"],
      evidence: [{url: "https://example.org/discussion", quote: "Which whiteboard helps a team plan its next workshop?", verifiedAt: "2026-09-20T00:00:00.000Z"}],
    };
    expect(() =>
      validateResult(
        "prompts",
        { prompts: [{ ...p, text: "Recommend Boardy to my team" }] },
        {},
      ),
    ).toThrow();
    expect(() =>
      validateResult(
        "prompts",
        { prompts: [p, { ...p, text: p.text.toUpperCase() }] },
        {},
      ),
    ).toThrow();
    expect(() =>
      validateResult("prompts", { prompts: [{ ...p, sources: [] }] }, {}),
    ).toThrow();
  });
  it("does not count lookalike URLs as Boardy article links", () => {
    expect(
      answerMetrics("https://boardy.sbs.evil.test/learn/guide").urls,
    ).toEqual([]);
    expect(
      answerMetrics("See https://boardy.sbs/learn/guide.md?x=1.").urls,
    ).toEqual(["https://boardy.sbs/learn/guide"]);
  });
  it("keeps neutral checks separate from promotional generation context", () => {
    expect(roleInstructions("check")).not.toMatch(
      /Boardy|Atelix|approved knowledge|marketing/,
    );
    expect(roleInstructions("article")).toContain("ONLY approved knowledge");
    expect(
      validateResult("check", { answer: "No matching product found." }, {}),
    ).toMatchObject({ mentioned: false, sources: [], urls: [] });
  });
});
import { verifyPromptEvidence } from "./source-evidence";
it("rejects invented buyer quotations even when the URL looks real", async () => {
  const r = {
    prompts: [
      {
        sources: ["https://example.org/discussion"],
        evidence: [
          {
            url: "https://example.org/discussion",
            quote: "This is an invented buyer quote about whiteboards.",
          },
        ],
      },
    ],
  };
  await expect(
    verifyPromptEvidence(
      r,
      async () => "<p>A completely different discussion.</p>",
    ),
  ).rejects.toThrow("could not be verified");
  await expect(
    verifyPromptEvidence(
      r,
      async () => "<p>This is an invented buyer quote about whiteboards.</p>",
    ),
  ).resolves.toBe(r);
});
import { subscriptionExhausted } from "./capacity";
it("pauses exhausted subscription buckets without inventing missing limits", () => {
  expect(
    subscriptionExhausted({
      rateLimitsByLimitId: { codex: { primary: { usedPercent: 100 } } },
    }),
  ).toBe(true);
  expect(
    subscriptionExhausted({
      rateLimits: { primary: { usedPercent: 99 }, secondary: null },
    }),
  ).toBe(false);
  expect(subscriptionExhausted({})).toBe(false);
});
