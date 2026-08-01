import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  GenericContainer,
  Wait,
  type StartedTestContainer,
} from "testcontainers";
import { createS3StorageAdapter } from "@crazyglegit/support-storage-s3";

describe("private S3-compatible attachment storage", () => {
  let container: StartedTestContainer | undefined;
  let storage: ReturnType<typeof createS3StorageAdapter> | undefined;
  beforeAll(async () => {
    container = await new GenericContainer(
      "minio/minio:RELEASE.2024-01-16T16-07-38Z",
    )
      .withEnvironment({
        MINIO_ROOT_USER: "minioadmin",
        MINIO_ROOT_PASSWORD: "minioadmin",
      })
      .withExposedPorts(9000)
      .withCommand(["server", "/data", "--console-address", ":9001"])
      .withWaitStrategy(Wait.forHttp("/minio/health/ready", 9000))
      .start();
    await container.exec(["mkdir", "-p", "/data/support-test-private"]);
    storage = createS3StorageAdapter({
      region: "us-east-1",
      bucket: "support-test-private",
      endpoint: `http://${container.getHost()}:${String(container.getMappedPort(9000))}`,
      forcePathStyle: true,
      allowInsecureDevelopmentEndpoint: true,
      credentials: { accessKeyId: "minioadmin", secretAccessKey: "minioadmin" },
    });
  });
  afterAll(async () => {
    if (storage) await storage.dispose();
    if (container) await container.stop();
  });

  it("presigns PUT, verifies private object metadata, presigns GET, and deletes", async () => {
    if (!storage) throw new Error("S3 storage adapter was not initialized.");
    const projectId = "11111111-1111-4111-8111-111111111111";
    const conversationId = "22222222-2222-4222-8222-222222222222";
    const attachmentId = "33333333-3333-4333-8333-333333333333";
    const storageKey = `support/${projectId}/${conversationId}/${attachmentId}/44444444-4444-4444-8444-444444444444`;
    const target = await storage.createUploadTarget({
      projectId,
      conversationId,
      attachmentId,
      storageKey,
      contentType: "text/plain",
      sizeBytes: 4,
      expiresInSeconds: 60,
    });
    const uploaded = await fetch(target.url, {
      method: target.method,
      headers: target.headers,
      body: "test",
    });
    expect(uploaded.ok).toBe(true);
    await expect(storage.statObject(storageKey)).resolves.toMatchObject({
      sizeBytes: 4,
      contentType: "text/plain",
    });
    const download = await storage.createDownloadUrl({
      storageKey,
      fileName: "../../safe.txt",
      contentType: "text/plain",
      expiresInSeconds: 60,
    });
    const response = await fetch(download.url);
    expect(await response.text()).toBe("test");
    expect(response.headers.get("content-disposition")).toContain(
      "attachment;",
    );
    await storage.deleteObject(storageKey);
    await expect(storage.statObject(storageKey)).rejects.toBeDefined();
  });
});
