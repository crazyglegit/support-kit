import type { ConversationStatus } from "@crazyglegit/support-core";

/** Supported application event names. */
export type ApplicationEventType =
  | "conversation.created"
  | "conversation.assigned"
  | "conversation.status_changed"
  | "message.created"
  | "message.read"
  | "internal_note.created"
  | "customer.updated"
  | "agent.updated"
  | "conversation.tag_added"
  | "conversation.tag_removed";

/** Plain framework-independent application event. */
export interface ApplicationEvent<TData = Readonly<Record<string, unknown>>> {
  readonly id: string;
  readonly type: ApplicationEventType;
  readonly projectId: string;
  readonly conversationId?: string;
  readonly occurredAt: Date;
  readonly data: TData;
}

/** Data emitted when a conversation status changes. */
export interface ConversationStatusChangedData {
  readonly conversationId: string;
  readonly previousStatus: ConversationStatus;
  readonly status: ConversationStatus;
  readonly actorId: string;
}
