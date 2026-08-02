import { describe, expect, it } from "vitest";
import { createChatbotAIAdapter } from "./index.js";

const input = {
  systemPolicy: "Use supplied knowledge only.",
  message: "When can I get a refund?",
  conversation: [],
  knowledge: [
    {
      sourceKey: "refund-policy",
      title: "Refunds",
      content: "Within 30 days.",
    },
  ],
  allowedCitationSourceKeys: ["refund-policy"],
  maximumOutputCharacters: 1000,
};

describe("createChatbotAIAdapter", () => {
  it("rejects malformed provider output", async () => {
    const adapter = createChatbotAIAdapter({
      generateDraft: () => Promise.resolve({ content: "draft" }),
      generateAnswer: () =>
        Promise.resolve({ answer: "Missing required fields" }),
    });
    await expect(adapter.generateChatbotAnswer?.(input)).rejects.toThrow(
      "invalid",
    );
  });

  it("rejects provider fields outside the public output contract", async () => {
    const adapter = createChatbotAIAdapter({
      generateDraft: () => Promise.resolve({ content: "draft" }),
      generateAnswer: () =>
        Promise.resolve({
          answer: "Within 30 days.",
          citedSourceKeys: ["refund-policy"],
          shouldEscalate: false,
          ignored: "secret",
        }),
    });
    await expect(adapter.generateChatbotAnswer?.(input)).rejects.toThrow(
      "invalid",
    );
  });
});
