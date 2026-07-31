/** Supported conversation lifecycle states. */
export const CONVERSATION_STATUSES = [
  "open",
  "waiting_for_agent",
  "waiting_for_customer",
  "resolved",
  "closed",
  "spam",
] as const;

/** A supported conversation lifecycle state. */
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

/** Supported message classifications. */
export const MESSAGE_TYPES = [
  "text",
  "image",
  "file",
  "bot",
  "system",
  "internal_note",
  "quick_reply",
] as const;

/** A supported message classification. */
export type MessageType = (typeof MESSAGE_TYPES)[number];

/** Supported message sender classifications. */
export const SENDER_TYPES = [
  "customer",
  "visitor",
  "agent",
  "bot",
  "system",
] as const;

/** A supported message sender classification. */
export type SenderType = (typeof SENDER_TYPES)[number];

/** Supported delivery states for a message. */
export const MESSAGE_DELIVERY_STATUSES = [
  "pending",
  "sent",
  "delivered",
  "read",
  "failed",
] as const;

/** A supported delivery state for a message. */
export type MessageDeliveryStatus = (typeof MESSAGE_DELIVERY_STATUSES)[number];

/** Built-in role names available for host role mapping. */
export const DEFAULT_ROLES = [
  "support_admin",
  "support_supervisor",
  "support_agent",
  "support_viewer",
  "customer",
  "anonymous_visitor",
] as const;

/** A built-in role name. Roles do not replace permission checks. */
export type DefaultRole = (typeof DEFAULT_ROLES)[number];

/** Stable support permission names. */
export const SUPPORT_PERMISSIONS = [
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

/** A stable support permission name. */
export type SupportPermission = (typeof SUPPORT_PERMISSIONS)[number];
