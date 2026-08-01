import { z } from "zod";
import { API_ERROR_CODES } from "./api.js";
import {
  clientMessageIdSchema,
  identifierSchema,
  isoTimestampSchema,
} from "./shared.js";

const SUPPORT_PERMISSIONS = [
  "conversation.read",
  "conversation.reply",
  "conversation.assign",
  "conversation.close",
  "conversation.reopen",
  "conversation.mark_spam",
  "internal_note.read",
  "internal_note.create",
  "customer.read",
  "customer.update",
  "knowledge.read",
  "knowledge.manage",
  "saved_reply.read",
  "saved_reply.manage",
  "support_settings.read",
  "support_settings.manage",
  "audit.read",
] as const;

export const dashboardConversationStatusSchema = z.enum([
  "open",
  "waiting_for_agent",
  "waiting_for_customer",
  "resolved",
  "closed",
  "spam",
]);
export const dashboardMessageTypeSchema = z.enum([
  "text",
  "image",
  "file",
  "quick_reply",
  "system",
  "internal_note",
]);
export const dashboardSenderTypeSchema = z.enum([
  "customer",
  "visitor",
  "agent",
  "bot",
  "system",
]);
export const dashboardPermissionSchema = z.enum(SUPPORT_PERMISSIONS);

export const dashboardAgentSessionSchema = z.strictObject({
  actor: z.strictObject({
    type: z.literal("agent"),
    id: identifierSchema,
    role: z.enum([
      "support_admin",
      "support_supervisor",
      "support_agent",
      "support_viewer",
    ]),
    permissions: z.array(dashboardPermissionSchema),
  }),
});

export const dashboardConversationSchema = z.strictObject({
  id: identifierSchema,
  status: dashboardConversationStatusSchema,
  subject: z.string().max(500).optional(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

export const dashboardMessageSchema = z.strictObject({
  id: identifierSchema,
  conversationId: identifierSchema,
  clientMessageId: clientMessageIdSchema.optional(),
  type: dashboardMessageTypeSchema,
  senderType: dashboardSenderTypeSchema,
  body: z.string().max(50_000),
  deliveryStatus: z.enum(["pending", "sent", "delivered", "read", "failed"]),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

export const dashboardConversationDetailSchema = z.strictObject({
  conversation: dashboardConversationSchema,
  messages: z.array(dashboardMessageSchema),
});

export const dashboardApiErrorEnvelopeSchema = z.strictObject({
  success: z.literal(false),
  error: z.strictObject({
    code: z.enum(API_ERROR_CODES),
    message: z.string().min(1),
    requestId: z.string().min(1).optional(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const dashboardSocketEventEnvelopeSchema = z.strictObject({
  eventId: identifierSchema,
  eventType: z.enum([
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
  ]),
  version: z.literal(1),
  conversationId: identifierSchema.optional(),
  occurredAt: isoTimestampSchema,
  data: z.unknown(),
});

export type DashboardAgentSession = z.infer<typeof dashboardAgentSessionSchema>;
export type DashboardConversation = z.infer<typeof dashboardConversationSchema>;
export type DashboardMessage = z.infer<typeof dashboardMessageSchema>;
