import { describe, expect, it } from "vitest";
import { normalizeAttachmentFilename } from "./attachments.js";

describe("attachment filename safety", () => {
  it("normalizes traversal, separators, controls, unicode, and empty names", () => {
    expect(normalizeAttachmentFilename("../folder\\evil\u0000.txt")).toBe(
      "folder-evil.txt",
    );
    expect(normalizeAttachmentFilename("\u0000/../")).toBe("attachment");
    expect(normalizeAttachmentFilename("ｅｖｉｌ.txt")).toBe("evil.txt");
  });

  it("bounds display filenames without using them as storage keys", () => {
    expect(normalizeAttachmentFilename("a".repeat(400))).toHaveLength(255);
  });
});
