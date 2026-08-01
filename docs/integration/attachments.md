# Configuring attachments

```ts
import { createS3StorageAdapter } from "@crazyglegit/support-storage-s3";

const storage = createS3StorageAdapter({
  region: process.env.S3_REGION!,
  bucket: process.env.S3_PRIVATE_BUCKET!,
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  serverSideEncryption: "AES256",
});

const config = defineSupportConfig({
  // existing project, database, auth, and security configuration
  storage,
  attachmentScanner: productionScanner,
  attachments: {
    enabled: true,
    maxFileSizeBytes: 25 * 1024 * 1024,
    maxFilesPerMessage: 5,
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
      "text/plain",
      "text/csv",
    ],
    uploadUrlTtlSeconds: 300,
    downloadUrlTtlSeconds: 120,
    scanPolicy: "required",
  },
});
```

The bucket must block public access. CORS should allow only the application origins, `PUT` and `GET`, and only required upload headers such as `content-type` and configured encryption headers. Never allow `*` with credentials. AWS S3 uses its normal HTTPS endpoint. MinIO commonly uses `forcePathStyle`; plain HTTP is accepted only for an explicitly enabled loopback development endpoint.

`required` and `optional` scanning both fail closed when no clean verdict is available. `disabled` must be explicit, records `skipped`, and is unsafe for production even though size and object metadata are still verified. The demo's scanner is an explicit development fixture, not antivirus software.

Uploads use XHR for progress and cancellation. A failed or expired target is retried through a new intent. Widget and dashboard destruction aborts active uploads. Dashboard queues are separate for each conversation and for public reply versus internal-note mode.

Troubleshooting: verify private bucket CORS, endpoint HTTPS/path style, clock synchronization for signatures, configured MIME allowlists, scanner availability, and that migrations include `0002_secure_attachments.sql`.
