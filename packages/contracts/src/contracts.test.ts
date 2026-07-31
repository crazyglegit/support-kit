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
    projectId: "main-app",
    auth,
    database,
    realtime,
    widget: { theme: "system", allowAnonymousVisitors: true },
    features: { attachments: true },
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
    expect(result.projectId).toBe("main-app");
  });

  it("rejects invalid declarative configuration", () => {
    expect(() => defineSupportConfig({ ...config, projectId: "" })).toThrow();
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
    expect(API_ERROR_CODES).toHaveLength(8);
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
