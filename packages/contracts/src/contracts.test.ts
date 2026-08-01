import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  agentIdentitySchema,
  API_ERROR_CODES,
  apiErrorEnvelopeSchema,
  CONVERSATION_STATUSES,
  conversationStatusSchema,
  createApiSuccessEnvelopeSchema,
  createRealtimeEventEnvelopeSchema,
  messageSendSchema,
  customerIdentitySchema,
  DEFAULT_ROLES,
  defaultRoleSchema,
  defineSupportConfig,
  deliveryStatusSchema,
  MESSAGE_DELIVERY_STATUSES,
  MESSAGE_TYPES,
  messageTypeSchema,
  permissionSchema,
  SENDER_TYPES,
  senderTypeSchema,
  SUPPORT_PERMISSIONS,
  supportSocketAcknowledgementSchema,
  supportSocketEventEnvelopeSchema,
  visitorIdentitySchema,
} from "./index.js";
import type {
  SupportAuthAdapter,
  SupportConfig,
  SupportDatabaseAdapter,
  SupportRealtimeAdapter,
} from "./index.js";

describe("identity contracts", () => {
  it("accepts valid customer, visitor, and agent identities", () => {
    expect(
      customerIdentitySchema.parse({
        id: "customer-1",
        email: "customer@example.com",
      }),
    ).toEqual({
      id: "customer-1",
      email: "customer@example.com",
    });
    expect(
      visitorIdentitySchema.safeParse({
        id: "visitor-1",
        sessionId: "session-1",
      }).success,
    ).toBe(true);
    expect(
      agentIdentitySchema.safeParse({
        id: "agent-1",
        name: "Support Agent",
        role: "support_agent",
        permissions: ["conversation.read", "conversation.reply"],
      }).success,
    ).toBe(true);
  });

  it.each([
    [customerIdentitySchema, { id: "", email: "invalid" }],
    [visitorIdentitySchema, { id: "visitor-1" }],
    [agentIdentitySchema, { id: "agent-1", name: "", permissions: ["root"] }],
  ])("rejects invalid identity input", (schema, input) => {
    expect(schema.safeParse(input).success).toBe(false);
  });
});

describe("Socket.IO contracts", () => {
  it("strictly validates client payloads, acknowledgements, and envelopes", () => {
    expect(
      messageSendSchema.safeParse({
        conversationId: "conversation-1",
        body: "Hello",
        clientMessageId: "client-message-01",
      }).success,
    ).toBe(true);
    expect(
      messageSendSchema.safeParse({
        conversationId: "conversation-1",
        body: "Hello",
        clientMessageId: "client-message-01",
        projectId: "untrusted-project",
      }).success,
    ).toBe(false);
    expect(
      supportSocketAcknowledgementSchema.safeParse({
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Access denied.",
          requestId: "request-1",
        },
      }).success,
    ).toBe(true);
    expect(
      supportSocketEventEnvelopeSchema.safeParse({
        eventId: "event-1",
        eventType: "message.created",
        version: 1,
        occurredAt: "2026-08-01T00:00:00.000Z",
        conversationId: "conversation-1",
        data: { messageId: "message-1" },
      }).success,
    ).toBe(true);
  });
});

describe("configuration contract", () => {
  const auth: SupportAuthAdapter = {
    getAgent: () => Promise.resolve(null),
    getCustomer: () => Promise.resolve(null),
    getVisitor: () => Promise.resolve(null),
  };
  const database = {} as SupportDatabaseAdapter;
  const realtime: SupportRealtimeAdapter = {
    authorize: () => Promise.resolve(false),
    publish: () => Promise.resolve(),
  };
  const config: SupportConfig = {
    projectKey: "main-app",
    auth,
    database,
    realtime,
    widget: { theme: "system", allowAnonymousVisitors: true },
    features: { attachments: false },
    security: {
      allowedOrigins: ["https://example.com"],
      maxUploadBytes: 5_000_000,
    },
  };

  it("validates declarative fields and preserves adapters", () => {
    const result = defineSupportConfig(config);

    expect(result.auth).toBe(auth);
    expect(result.database).toBe(database);
    expect(result.realtime).toBe(realtime);
    expect(result.projectKey).toBe("main-app");
  });

  it("rejects invalid declarative configuration", () => {
    expect(() => defineSupportConfig({ ...config, projectKey: "" })).toThrow();
    expect(() =>
      defineSupportConfig({
        ...config,
        security: { allowedOrigins: ["https://example.com/path"] },
      }),
    ).toThrow();
    expect(() =>
      defineSupportConfig({
        ...config,
        widget: { accentColor: "javascript:red" },
      }),
    ).toThrow();
  });

  it("requires explicit secure attachment adapters and preserves disabled compatibility", () => {
    const storage = {
      createUploadTarget: () => Promise.reject(new Error("unused")),
      statObject: () => Promise.reject(new Error("unused")),
      createDownloadUrl: () => Promise.reject(new Error("unused")),
      deleteObject: () => Promise.resolve(),
    };
    expect(() =>
      defineSupportConfig({
        ...config,
        attachments: {
          enabled: true,
          maxFileSizeBytes: 10_000_000,
          maxFilesPerMessage: 5,
          allowedMimeTypes: ["image/png"],
          uploadUrlTtlSeconds: 300,
          downloadUrlTtlSeconds: 60,
          scanPolicy: "required",
        },
      }),
    ).toThrow(/storage/u);
    expect(() =>
      defineSupportConfig({
        ...config,
        storage,
        attachments: {
          enabled: true,
          maxFileSizeBytes: 10_000_000,
          maxFilesPerMessage: 5,
          allowedMimeTypes: ["image/png"],
          uploadUrlTtlSeconds: 300,
          downloadUrlTtlSeconds: 60,
          scanPolicy: "required",
        },
      }),
    ).toThrow(/scanner/u);
    expect(
      defineSupportConfig({
        ...config,
        storage,
        attachments: {
          enabled: true,
          maxFileSizeBytes: 10_000_000,
          maxFilesPerMessage: 5,
          allowedMimeTypes: ["image/png"],
          uploadUrlTtlSeconds: 300,
          downloadUrlTtlSeconds: 60,
          scanPolicy: "disabled",
        },
      }).attachments,
    ).toMatchObject({
      enabled: true,
      scanPolicy: "disabled",
      maxFilesPerMessage: 5,
    });
  });
});

describe("API envelopes", () => {
  it("parses structured errors and rejects unknown codes", () => {
    expect(
      apiErrorEnvelopeSchema.safeParse({
        success: false,
        error: { code: "FORBIDDEN", message: "Access denied" },
      }).success,
    ).toBe(true);
    expect(
      apiErrorEnvelopeSchema.safeParse({
        success: false,
        error: { code: "UNKNOWN", message: "No" },
      }).success,
    ).toBe(false);
  });

  it("parses typed success data", () => {
    const schema = createApiSuccessEnvelopeSchema(z.object({ id: z.string() }));
    expect(
      schema.safeParse({ success: true, data: { id: "item-1" } }).success,
    ).toBe(true);
    expect(schema.safeParse({ success: true, data: {} }).success).toBe(false);
  });
});

describe("realtime event envelope", () => {
  const schema = createRealtimeEventEnvelopeSchema(
    z.object({ messageId: z.string() }),
  );

  it("parses versioned events with ISO timestamps", () => {
    expect(
      schema.safeParse({
        eventId: "event-1",
        eventType: "message.created",
        eventVersion: 1,
        projectId: "main-app",
        conversationId: "conversation-1",
        occurredAt: "2026-07-31T12:00:00Z",
        data: { messageId: "message-1" },
      }).success,
    ).toBe(true);
  });

  it("rejects malformed versions, timestamps, and payloads", () => {
    expect(
      schema.safeParse({
        eventId: "event-1",
        eventType: "message.created",
        eventVersion: 0,
        projectId: "main-app",
        occurredAt: "yesterday",
        data: {},
      }).success,
    ).toBe(false);
  });
});

describe("enum schemas", () => {
  it.each([
    [conversationStatusSchema, CONVERSATION_STATUSES],
    [messageTypeSchema, MESSAGE_TYPES],
    [senderTypeSchema, SENDER_TYPES],
    [deliveryStatusSchema, MESSAGE_DELIVERY_STATUSES],
    [defaultRoleSchema, DEFAULT_ROLES],
    [permissionSchema, SUPPORT_PERMISSIONS],
  ] as const)(
    "accepts every declared value and rejects an unknown value",
    (schema, values) => {
      for (const value of values) {
        expect(schema.safeParse(value).success).toBe(true);
      }
      expect(schema.safeParse("not-a-real-value").success).toBe(false);
    },
  );

  it("declares every required API error code", () => {
    expect(API_ERROR_CODES).toHaveLength(21);
    for (const code of API_ERROR_CODES) {
      expect(
        apiErrorEnvelopeSchema.safeParse({
          success: false,
          error: { code, message: code },
        }).success,
      ).toBe(true);
    }
  });
});
