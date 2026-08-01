import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  AdapterHealthResult,
  CreateDownloadUrlInput,
  CreateUploadTargetInput,
  StoredObjectMetadata,
  SupportStorageAdapter,
  UploadTarget,
} from "@crazyglegit/support-contracts";

export interface S3StorageAdapterOptions {
  readonly region: string;
  readonly bucket: string;
  readonly endpoint?: string;
  readonly forcePathStyle?: boolean;
  readonly credentials?: {
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly sessionToken?: string;
  };
  readonly serverSideEncryption?: "AES256" | "aws:kms";
  readonly kmsKeyId?: string;
  /** Allows plain HTTP only for loopback/local MinIO development. */
  readonly allowInsecureDevelopmentEndpoint?: boolean;
}

function validateOptions(options: S3StorageAdapterOptions): void {
  if (!options.region.trim() || !options.bucket.trim())
    throw new TypeError("S3 region and bucket are required.");
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u.test(options.bucket))
    throw new TypeError("S3 bucket name is invalid.");
  if (options.endpoint) {
    const endpoint = new URL(options.endpoint);
    if (
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash
    )
      throw new TypeError(
        "S3 endpoint must not contain credentials, query, or fragment.",
      );
    const local =
      endpoint.hostname === "localhost" ||
      endpoint.hostname === "127.0.0.1" ||
      endpoint.hostname === "::1";
    if (
      endpoint.protocol !== "https:" &&
      !(options.allowInsecureDevelopmentEndpoint && local)
    )
      throw new TypeError(
        "S3 endpoints must use HTTPS outside explicit local development.",
      );
  }
  if (options.serverSideEncryption === "aws:kms" && !options.kmsKeyId)
    throw new TypeError("S3 KMS encryption requires kmsKeyId.");
}

function validateStorageKey(key: string): void {
  if (
    !/^support\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/iu.test(
      key,
    )
  )
    throw new TypeError("Storage key is outside the Support Kit namespace.");
}

function createSafeContentDisposition(fileName: string): string {
  const printable = Array.from(fileName.normalize("NFKC"))
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint > 0x1f && codePoint !== 0x7f;
    })
    .join("");
  const safeName =
    printable
      .replace(/["/\\;]/gu, "_")
      .replace(/\.\.+/gu, ".")
      .replace(/^[.\s]+/u, "")
      .slice(0, 255) || "attachment";
  const ascii =
    safeName.replace(/[^\x20-\x7e]/gu, "_").slice(0, 150) || "attachment";
  const encoded = encodeURIComponent(safeName).replace(
    /[!'()*]/gu,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export class S3StorageAdapter implements SupportStorageAdapter {
  readonly #client: S3Client;
  readonly #options: S3StorageAdapterOptions;
  #disposed = false;

  public constructor(options: S3StorageAdapterOptions) {
    validateOptions(options);
    this.#options = options;
    this.#client = new S3Client({
      region: options.region,
      ...(options.endpoint ? { endpoint: options.endpoint } : {}),
      ...(options.forcePathStyle === undefined
        ? {}
        : { forcePathStyle: options.forcePathStyle }),
      ...(options.credentials ? { credentials: options.credentials } : {}),
    });
  }
  #assertActive(): void {
    if (this.#disposed) throw new Error("Storage adapter is disposed.");
  }
  public async createUploadTarget(
    input: CreateUploadTargetInput,
  ): Promise<UploadTarget> {
    this.#assertActive();
    validateStorageKey(input.storageKey);
    const command = new PutObjectCommand({
      Bucket: this.#options.bucket,
      Key: input.storageKey,
      ContentType: input.contentType,
      ContentLength: input.sizeBytes,
      ...(this.#options.serverSideEncryption
        ? {
            ServerSideEncryption: this.#options.serverSideEncryption,
          }
        : {}),
      ...(this.#options.kmsKeyId
        ? { SSEKMSKeyId: this.#options.kmsKeyId }
        : {}),
    });
    const url = await getSignedUrl(this.#client, command, {
      expiresIn: input.expiresInSeconds,
    });
    return {
      method: "PUT",
      url,
      headers: {
        "content-type": input.contentType,
        ...(this.#options.serverSideEncryption
          ? {
              "x-amz-server-side-encryption":
                this.#options.serverSideEncryption,
            }
          : {}),
        ...(this.#options.kmsKeyId
          ? {
              "x-amz-server-side-encryption-aws-kms-key-id":
                this.#options.kmsKeyId,
            }
          : {}),
      },
      expiresAt: new Date(
        Date.now() + input.expiresInSeconds * 1000,
      ).toISOString(),
    };
  }
  public async statObject(storageKey: string): Promise<StoredObjectMetadata> {
    this.#assertActive();
    validateStorageKey(storageKey);
    const result = await this.#client.send(
      new HeadObjectCommand({ Bucket: this.#options.bucket, Key: storageKey }),
    );
    if (result.ContentLength === undefined)
      throw new Error("Stored object size is unavailable.");
    return {
      sizeBytes: result.ContentLength,
      ...(result.ContentType ? { contentType: result.ContentType } : {}),
      ...(result.ChecksumSHA256
        ? { checksumSha256: result.ChecksumSHA256 }
        : {}),
    };
  }
  public async createDownloadUrl(input: CreateDownloadUrlInput) {
    this.#assertActive();
    validateStorageKey(input.storageKey);
    const command = new GetObjectCommand({
      Bucket: this.#options.bucket,
      Key: input.storageKey,
      ResponseContentType: input.contentType,
      ResponseContentDisposition: createSafeContentDisposition(input.fileName),
    });
    return {
      url: await getSignedUrl(this.#client, command, {
        expiresIn: input.expiresInSeconds,
      }),
      expiresAt: new Date(
        Date.now() + input.expiresInSeconds * 1000,
      ).toISOString(),
    };
  }
  public async deleteObject(storageKey: string): Promise<void> {
    this.#assertActive();
    validateStorageKey(storageKey);
    await this.#client.send(
      new DeleteObjectCommand({
        Bucket: this.#options.bucket,
        Key: storageKey,
      }),
    );
  }
  public async healthCheck(): Promise<AdapterHealthResult> {
    if (this.#disposed)
      return { status: "unhealthy", message: "Storage adapter is disposed." };
    try {
      await this.#client.send(
        new HeadBucketCommand({ Bucket: this.#options.bucket }),
      );
      return { status: "healthy" };
    } catch {
      return {
        status: "unhealthy",
        message: "Private object storage is unavailable.",
      };
    }
  }
  public dispose(): Promise<void> {
    if (this.#disposed) return Promise.resolve();
    this.#disposed = true;
    this.#client.destroy();
    return Promise.resolve();
  }
}

export function createS3StorageAdapter(
  options: S3StorageAdapterOptions,
): S3StorageAdapter {
  return new S3StorageAdapter(options);
}
