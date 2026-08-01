import { z } from "zod";
import {
  clientMessageIdSchema,
  identifierSchema,
  isoTimestampSchema,
} from "./shared.js";

const customerConversationStatusSchema = z.enum([
  "open",
  "waiting_for_agent",
  "waiting_for_customer",
  "resolved",
  "closed",
  "spam",
]);
const customerDeliveryStatusSchema = z.enum([
  "pending",
  "sent",
  "delivered",
  "read",
  "failed",
]);
const widgetSocketServerEventSchema = z.enum([
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
]);

/** Customer-visible conversation transport shape. */
export const customerConversationSchema = z.strictObject({
  id: identifierSchema,
  status: customerConversationStatusSchema,
  subject: z.string().max(500).optional(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

/** Customer-visible messages are deliberately limited to public plain-text types. */
export const customerMessageSchema = z.strictObject({
  id: identifierSchema,
  conversationId: identifierSchema,
  clientMessageId: clientMessageIdSchema.optional(),
  type: z.enum(["text", "image", "file", "quick_reply", "bot", "system"]),
  senderType: z.enum(["customer", "visitor", "agent", "bot", "system"]),
  body: z.string().max(50_000),
  deliveryStatus: customerDeliveryStatusSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

/** Browser-safe server configuration for the prebuilt customer widget. */
export const publicWidgetConfigurationSchema = z.strictObject({
  title: z.string().trim().min(1).max(100).optional(),
  greeting: z.string().trim().min(1).max(500).optional(),
  launcherLabel: z.string().trim().min(1).max(100).optional(),
  position: z.enum(["bottom-left", "bottom-right"]).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  locale: z.string().trim().min(2).max(35).optional(),
  features: z.strictObject({
    attachments: z.boolean(),
    chatbot: z.boolean(),
  }),
});

/** Browser-safe public Socket.IO envelope without a dependency on domain modules. */
export const widgetSocketEventEnvelopeSchema = z.strictObject({
  eventId: identifierSchema,
  eventType: widgetSocketServerEventSchema,
  version: z.number().int().positive(),
  conversationId: identifierSchema.optional(),
  occurredAt: isoTimestampSchema,
  data: z.unknown(),
});

/** Browser-safe structured API error envelope. */
export const widgetApiErrorEnvelopeSchema = z.strictObject({
  success: z.literal(false),
  error: z.strictObject({
    code: z.enum([
      "VALIDATION_ERROR",
      "UNAUTHENTICATED",
      "FORBIDDEN",
      "NOT_FOUND",
      "CONFLICT",
      "RATE_LIMITED",
      "INVALID_STATE_TRANSITION",
      "INTERNAL_ERROR",
    ]),
    message: z.string().min(1),
    details: z.record(z.string(), z.unknown()).optional(),
    requestId: z.string().min(1).optional(),
  }),
});

export type CustomerConversation = z.infer<typeof customerConversationSchema>;
export type CustomerMessage = z.infer<typeof customerMessageSchema>;
export type PublicWidgetConfiguration = z.infer<
  typeof publicWidgetConfigurationSchema
>;
