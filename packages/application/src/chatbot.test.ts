import { describe, expect, it } from "vitest";
import { chunkKnowledge } from "./chatbot.js";

describe("knowledge chunking", () => {
  it("creates bounded, deterministic, project-scoped chunks", () => {
    let sequence = 0;
    const chunks = chunkKnowledge({
      projectId: "project-1",
      articleId: "article-1",
      revisionNumber: 2,
      sourceKey: "refund-policy",
      title: "Refund policy",
      body: "Refunds are available within thirty days. ".repeat(20),
      maximumCharacters: 220,
      overlapCharacters: 30,
      ids: { generate: () => `chunk-${String(++sequence)}` },
      now: new Date("2026-08-02T00:00:00.000Z"),
    });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.projectId === "project-1")).toBe(true);
    expect(chunks.every((chunk) => chunk.characterCount <= 220)).toBe(true);
    expect(new Set(chunks.map((chunk) => chunk.checksum)).size).toBe(
      chunks.length,
    );
  });
});
