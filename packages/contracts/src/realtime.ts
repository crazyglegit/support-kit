import { z } from "zod";
import { conversationStatusSchema } from "./enums.js";
import {
  clientMessageIdSchema,
  identifierSchema,
  isoTimestampSchema,
} from "./shared.js";
import { attachmentIdsSchema } from "./attachments.js";

export const SUPPORT_SOCKET_CLIENT_EVENTS = [
  "conversation.join",
  "conversation.leave",
  "message.send",
  "message.read",
  "typing.start",
  "typing.stop",
  "conversation.assign",
  "conversation.status.change",
  "conversation.reopen",
  "conversation.spam",
  "internal_note.create",
  "conversation.tag.add",
  "conversation.tag.remove",
] as const;

export const SUPPORT_SOCKET_SERVER_EVENTS = [
  "message.created",
  "message.read",
  "conversation.updated",
  "conversation.assigned",
  "conversation.status_changed",
  "internal_note.created",
  "conversation.tag_added",
  "conversation.tag_removed",
  "typing.updated",
  "presence.updated",
  "support.error",
] as const;

export const supportSocketClientEventSchema = z.enum(
  SUPPORT_SOCKET_CLIENT_EVENTS,
);
export const supportSocketServerEventSchema = z.enum(
  SUPPORT_SOCKET_SERVER_EVENTS,
);

const conversationInput = z.strictObject({
  conversationId: identifierSchema,
  requestId: identifierSchema.optional(),
});

export const conversationJoinSchema = conversationInput;
export const conversationLeaveSchema = conversationInput;
export const messageSendSchema = conversationInput
  .extend({
    body: z.string().trim().max(50_000).default(""),
    clientMessageId: clientMessageIdSchema,
    attachmentIds: attachmentIdsSchema.optional(),
  })
  .refine(
    (value) => value.body.length > 0 || (value.attachmentIds?.length ?? 0) > 0,
  );
export const messageReadSchema = z.strictObject({
  messageId: identifierSchema,
  requestId: identifierSchema.optional(),
});
export const typingSchema = conversationInput;
export const conversationAssignSchema = conversationInput.extend({
  agentId: identifierSchema,
});
export const conversationStatusChangeSchema = conversationInput.extend({
  status: conversationStatusSchema,
});
export const internalNoteCreateSchema = messageSendSchema;
export const conversationTagSchema = conversationInput.extend({
  tagId: identifierSchema,
});

export const supportSocketErrorSchema = z.strictObject({
  code: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1).max(500),
  requestId: identifierSchema,
});

export const supportSocketAcknowledgementSchema = z.discriminatedUnion("ok", [
  z.strictObject({
    ok: z.literal(true),
    data: z.unknown(),
    requestId: identifierSchema,
  }),
  z.strictObject({
    ok: z.literal(false),
    error: supportSocketErrorSchema,
  }),
]);

/** Public Socket.IO envelope. Project scope is intentionally server implicit. */
export function createSupportSocketEventEnvelopeSchema<
  TSchema extends z.ZodType,
>(data: TSchema) {
  return z.strictObject({
    eventId: identifierSchema,
    eventType: supportSocketServerEventSchema,
    version: z.number().int().positive(),
    conversationId: identifierSchema.optional(),
    occurredAt: isoTimestampSchema,
    data,
  });
}

export const supportSocketEventEnvelopeSchema =
  createSupportSocketEventEnvelopeSchema(z.unknown());

/** Creates a runtime schema for a versioned realtime event envelope. */
export function createRealtimeEventEnvelopeSchema<TSchema extends z.ZodType>(
  data: TSchema,
) {
  return z.strictObject({
    eventId: identifierSchema,
    eventType: z.string().trim().min(1).max(200),
    eventVersion: z.number().int().positive(),
    projectId: identifierSchema,
    conversationId: identifierSchema.optional(),
    occurredAt: isoTimestampSchema,
    data,
  });
}

/** Runtime schema for a realtime envelope with an unknown payload. */
export const realtimeEventEnvelopeSchema = createRealtimeEventEnvelopeSchema(
  z.unknown(),
);

/** A versioned realtime event envelope. */
export interface RealtimeEventEnvelope<TData = unknown> {
  readonly eventId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly projectId: string;
  readonly conversationId?: string;
  readonly occurredAt: string;
  readonly data: TData;
}

/** Public support realtime event envelope name used by adapter APIs. */
export type SupportRealtimeEvent<TData = unknown> =
  RealtimeEventEnvelope<TData>;

export type SupportSocketClientEvent = z.infer<
  typeof supportSocketClientEventSchema
>;
export type SupportSocketServerEvent = z.infer<
  typeof supportSocketServerEventSchema
>;
export type SupportSocketAcknowledgement<TData = unknown> =
  | { readonly ok: true; readonly data: TData; readonly requestId: string }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: string;
        readonly message: string;
        readonly requestId: string;
      };
    };
export interface SupportSocketEventEnvelope<TData = unknown> {
  readonly eventId: string;
  readonly eventType: SupportSocketServerEvent;
  readonly version: number;
  readonly conversationId?: string;
  readonly occurredAt: string;
  readonly data: TData;
}
