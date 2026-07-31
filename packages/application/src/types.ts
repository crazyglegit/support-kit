import type {
  Agent,
  AnonymousVisitor,
  Conversation,
  ConversationStatus,
  Customer,
  DefaultRole,
  Message,
  MessageReceipt,
  MessageType,
  SupportDatabaseAdapter,
  SupportPermission,
  Tag,
} from "@crazyglegit/support-core";
import type { ApplicationEvent } from "./events.js";

/** Supplies deterministic application time. */
export interface Clock {
  now(): Date;
}

/** Generates opaque domain identifiers. */
export interface IdGenerator {
  generate(): string;
}

/** Publishes framework-independent application events after commit. */
export interface ApplicationEventPublisher {
  publish(event: ApplicationEvent): Promise<void>;
}

/** Dependencies required by application use cases. */
export interface ApplicationDependencies {
  readonly database: SupportDatabaseAdapter;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly events?: ApplicationEventPublisher;
}

/** Customer or visitor actor authorized through conversation ownership. */
export interface CustomerActor {
  readonly type: "customer" | "visitor";
  readonly id: string;
}

/** Agent actor authorized through exact permissions. */
export interface AgentActor {
  readonly type: "agent";
  readonly id: string;
  readonly permissions: readonly SupportPermission[];
}

/** Actor that may participate in a conversation workflow. */
export type ConversationActor = CustomerActor | AgentActor;

/** Input for creating a conversation and its first message. */
export interface CreateConversationInput {
  readonly projectId: string;
  readonly actor: CustomerActor;
  readonly subject?: string;
  readonly initialMessage: {
    readonly body: string;
    readonly clientMessageId: string;
  };
}
export interface CreateConversationResult {
  readonly conversation: Conversation;
  readonly message: Message;
}

/** Input for sending a public conversation message. */
export interface SendMessageInput {
  readonly projectId: string;
  readonly conversationId: string;
  readonly actor: ConversationActor;
  readonly body: string;
  readonly clientMessageId: string;
  readonly type?: Exclude<MessageType, "internal_note">;
}

/** Input for creating an agent-only note. */
export interface AddInternalNoteInput {
  readonly projectId: string;
  readonly conversationId: string;
  readonly actor: AgentActor;
  readonly body: string;
  readonly clientMessageId: string;
}

/** Input for assigning a conversation to an agent. */
export interface AssignConversationInput {
  readonly projectId: string;
  readonly conversationId: string;
  readonly actor: AgentActor;
  readonly agentId: string;
}

/** Input for an explicit conversation lifecycle change. */
export interface ChangeConversationStatusInput {
  readonly projectId: string;
  readonly conversationId: string;
  readonly actor: AgentActor;
  readonly status: ConversationStatus;
}

/** Input for reopening a conversation. */
export type ReopenConversationInput = Omit<
  ChangeConversationStatusInput,
  "status"
>;
/** Input for marking a conversation as spam. */
export type MarkConversationAsSpamInput = Omit<
  ChangeConversationStatusInput,
  "status"
>;

/** Input for recording one actor's read receipt. */
export interface RecordMessageReadInput {
  readonly projectId: string;
  readonly messageId: string;
  readonly actor: ConversationActor;
}

/** Result of an idempotent read operation. */
export interface RecordMessageReadResult {
  readonly receipt: MessageReceipt;
  readonly created: boolean;
}

/** Input for creating or updating a host-backed customer. */
export interface UpsertCustomerInput {
  readonly projectId: string;
  readonly externalCustomerId: string;
  readonly name?: string;
  readonly email?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Input for creating or updating a host-backed agent. */
export interface UpsertAgentInput {
  readonly projectId: string;
  readonly externalAgentId: string;
  readonly name: string;
  readonly email?: string;
  readonly role: DefaultRole;
  readonly permissions: readonly SupportPermission[];
}

/** Input for provisioning a verified anonymous visitor. */
export interface UpsertVisitorInput {
  readonly projectId: string;
  readonly externalVisitorId: string;
  readonly sessionId?: string;
  readonly name?: string;
  readonly email?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Input for listing conversations owned by a customer or visitor. */
export interface ListCustomerConversationsInput {
  readonly projectId: string;
  readonly actor: CustomerActor;
}

/** Input for listing the agent inbox. */
export interface ListAgentInboxInput {
  readonly projectId: string;
  readonly actor: AgentActor;
  readonly assignedToAgentId?: string;
}

/** Input for listing messages visible to an actor. */
export interface ListConversationMessagesInput {
  readonly projectId: string;
  readonly conversationId: string;
  readonly actor: ConversationActor;
}

/** Input for associating a tag with a conversation. */
export interface ConversationTagInput {
  readonly projectId: string;
  readonly conversationId: string;
  readonly tagId: string;
  readonly actor: AgentActor;
}

export type {
  Agent,
  AnonymousVisitor,
  Conversation,
  Customer,
  Message,
  MessageReceipt,
  Tag,
};
