import {
  createSupportKit,
  defineSupportConfig,
  type SupportAuthAdapter,
} from "@crazyglegit/support";
import { createDrizzleSupportDatabase } from "@crazyglegit/support-db-drizzle";
import { createS3StorageAdapter } from "@crazyglegit/support-storage-s3";

const auth: SupportAuthAdapter = {
  getCustomer: (context) => {
    const customer = context.headers["x-demo-customer-id"];
    return Promise.resolve(
      customer ? { id: customer, name: "Demo customer" } : null,
    );
  },
  // Demo-only host verification. Production hosts must verify a signed visitor session.
  getVisitor: () =>
    Promise.resolve({
      id: "nextjs-demo-visitor",
      sessionId: "verified-demo-session",
    }),
  // Example-only host boundary: the host sets an HttpOnly cookie equal to its
  // development secret. Production applications must use their real session.
  getAgent: (context) => {
    const secret = process.env.SUPPORT_DEMO_AGENT_SECRET;
    const cookie = context.headers.cookie ?? "";
    if (
      !secret ||
      !cookie
        .split(";")
        .some((part) => part.trim() === `support_demo_agent=${secret}`)
    )
      return Promise.resolve(null);
    return Promise.resolve({
      id: "demo-agent",
      name: "Demo agent",
      role: "support_agent",
      permissions: [
        "conversation.read",
        "conversation.reply",
        "conversation.assign",
        "conversation.close",
        "conversation.reopen",
        "conversation.mark_spam",
        "internal_note.read",
        "internal_note.create",
        "customer.read",
      ],
    });
  },
};

/** Creates the demo's server-side Support Kit configuration. */
export function createDemoSupportConfig(databaseUrl: string) {
  const database = createDrizzleSupportDatabase({
    connectionString: databaseUrl,
  });
  const storage = process.env.SUPPORT_DEMO_S3_BUCKET
    ? createS3StorageAdapter({
        region: process.env.SUPPORT_DEMO_S3_REGION ?? "us-east-1",
        bucket: process.env.SUPPORT_DEMO_S3_BUCKET,
        endpoint:
          process.env.SUPPORT_DEMO_S3_ENDPOINT ?? "http://127.0.0.1:9000",
        forcePathStyle: true,
        allowInsecureDevelopmentEndpoint: true,
        credentials: {
          accessKeyId: process.env.SUPPORT_DEMO_S3_ACCESS_KEY ?? "minioadmin",
          secretAccessKey:
            process.env.SUPPORT_DEMO_S3_SECRET_KEY ?? "minioadmin",
        },
      })
    : undefined;
  return defineSupportConfig({
    projectKey: "main-app",
    projectInitialization: { mode: "require-existing" },
    database,
    auth,
    ...(storage
      ? {
          storage,
          attachments: {
            enabled: true,
            maxFileSizeBytes: 10_000_000,
            maxFilesPerMessage: 5,
            allowedMimeTypes: [
              "image/jpeg",
              "image/png",
              "image/webp",
              "application/pdf",
              "text/plain",
            ],
            uploadUrlTtlSeconds: 300,
            downloadUrlTtlSeconds: 60,
            scanPolicy: "required" as const,
          },
          // Development fixture only. It demonstrates the scanner boundary and
          // must be replaced with a real malware scanner in production.
          attachmentScanner: {
            scan: (input: {
              claimedMimeType: string;
              expectedSizeBytes: number;
            }) =>
              Promise.resolve({
                verdict: "clean" as const,
                detectedMimeType: input.claimedMimeType,
                sizeBytes: input.expectedSizeBytes,
              }),
          },
        }
      : {}),
    widget: { title: "Demo support", greeting: "How can we help?" },
    security: {
      allowedOrigins: [
        process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://127.0.0.1:3000",
      ],
    },
    lifecycle: { adapterOwnership: "sdk" },
  });
}

/** Minimal server-side composition health example. */
export async function inspectSupportHealth(databaseUrl: string) {
  const config = createDemoSupportConfig(databaseUrl);
  const support = await createSupportKit(config);
  try {
    return await support.healthCheck();
  } finally {
    await support.dispose();
  }
}
