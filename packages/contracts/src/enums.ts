import {
  CONVERSATION_STATUSES,
  DEFAULT_ROLES,
  MESSAGE_DELIVERY_STATUSES,
  MESSAGE_TYPES,
  SENDER_TYPES,
  SUPPORT_PERMISSIONS,
} from "@crazyglegit/support-core";
import { z } from "zod";

/** Runtime schema for conversation lifecycle states. */
export const conversationStatusSchema = z.enum(CONVERSATION_STATUSES);
/** Runtime schema for message classifications. */
export const messageTypeSchema = z.enum(MESSAGE_TYPES);
/** Runtime schema for sender classifications. */
export const senderTypeSchema = z.enum(SENDER_TYPES);
/** Runtime schema for message delivery states. */
export const deliveryStatusSchema = z.enum(MESSAGE_DELIVERY_STATUSES);
/** Runtime schema for built-in role names. */
export const defaultRoleSchema = z.enum(DEFAULT_ROLES);
/** Runtime schema for stable support permission names. */
export const permissionSchema = z.enum(SUPPORT_PERMISSIONS);

/** Transport representation of a conversation lifecycle state. */
export type ConversationStatus = z.infer<typeof conversationStatusSchema>;
/** Transport representation of a message classification. */
export type MessageType = z.infer<typeof messageTypeSchema>;
/** Transport representation of a sender classification. */
export type SenderType = z.infer<typeof senderTypeSchema>;
/** Transport representation of a delivery state. */
export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;
/** Transport representation of a built-in role. */
export type DefaultRole = z.infer<typeof defaultRoleSchema>;
/** Transport representation of a permission. */
export type SupportPermission = z.infer<typeof permissionSchema>;

export {
  CONVERSATION_STATUSES,
  DEFAULT_ROLES,
  MESSAGE_DELIVERY_STATUSES,
  MESSAGE_TYPES,
  SENDER_TYPES,
  SUPPORT_PERMISSIONS,
} from "@crazyglegit/support-core";
