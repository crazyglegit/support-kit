import { describe, expect, it } from "vitest";
import { createS3StorageAdapter } from "./index.js";

const options = {
  region: "us-east-1",
  bucket: "support-test-private",
  endpoint: "http://127.0.0.1:9000",
  forcePathStyle: true,
  allowInsecureDevelopmentEndpoint: true,
  credentials: { accessKeyId: "test-access", secretAccessKey: "test-secret" },
} as const;

describe("S3 storage adapter", () => {
  it("rejects unsafe endpoints and bucket configuration", () => {
    expect(() =>
      createS3StorageAdapter({
        ...options,
        endpoint: "http://storage.example.com",
      }),
    ).toThrow(/HTTPS/u);
    expect(() =>
      createS3StorageAdapter({
        ...options,
        endpoint: "https://user:pass@example.com",
      }),
    ).toThrow(/credentials/u);
    expect(() =>
      createS3StorageAdapter({ ...options, bucket: "INVALID" }),
    ).toThrow(/bucket/u);
  });

  it("creates a bounded private PUT target without exposing credentials", async () => {
    const storage = createS3StorageAdapter(options);
    const projectId = "11111111-1111-4111-8111-111111111111";
    const conversationId = "22222222-2222-4222-8222-222222222222";
    const attachmentId = "33333333-3333-4333-8333-333333333333";
    const target = await storage.createUploadTarget({
      projectId,
      conversationId,
      attachmentId,
      storageKey: `support/${projectId}/${conversationId}/${attachmentId}/44444444-4444-4444-8444-444444444444`,
      contentType: "text/plain",
      sizeBytes: 4,
      expiresInSeconds: 60,
    });
    expect(target.method).toBe("PUT");
    expect(target.headers).toEqual({ "content-type": "text/plain" });
    expect(target.url).not.toContain("test-secret");
    expect(target.url).not.toContain("file.txt");
    await storage.dispose();
    await storage.dispose();
  });

  it("rejects arbitrary object keys", async () => {
    const storage = createS3StorageAdapter(options);
    await expect(storage.statObject("../secret")).rejects.toThrow(/namespace/u);
  });
});
