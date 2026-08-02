import type {
  AddInternalNoteInput,
  AgentActor,
  AssignConversationInput,
  ChangeConversationStatusInput,
  ConversationTagInput,
  CreateConversationInput,
  CreateConversationResult,
  CustomerActor,
  ListAgentInboxInput,
  ListConversationMessagesInput,
  ListCustomerConversationsInput,
  RecordMessageReadInput,
  RecordMessageReadResult,
  SendMessageInput,
  UpsertAgentInput,
  UpsertCustomerInput,
} from "@crazyglegit/support-application";
import type {
  Agent,
  Conversation,
  ConversationAssignment,
  Customer,
  Message,
  Tag,
  AttachmentMetadata,
  ChatbotHandoff,
  ChatbotSession,
  ChatbotTurn,
  KnowledgeArticle,
  KnowledgeArticleRevision,
} from "@crazyglegit/support-core";
import type {
  DefaultRole,
  SupportAuthContext,
  SupportConfig,
} from "@crazyglegit/support-contracts";

export type SupportKitConfig = SupportConfig;
type WithoutProject<T> = Omit<T, "projectId">;

export type CreateConversationOperationInput =
  WithoutProject<CreateConversationInput>;
export type SendMessageOperationInput = WithoutProject<SendMessageInput>;
export type AddInternalNoteOperationInput =
  WithoutProject<AddInternalNoteInput>;
export type AssignConversationOperationInput =
  WithoutProject<AssignConversationInput>;
export type ChangeConversationStatusOperationInput =
  WithoutProject<ChangeConversationStatusInput>;
export type ReopenConversationOperationInput = Omit<
  ChangeConversationStatusOperationInput,
  "status"
>;
export type MarkConversationSpamOperationInput =
  ReopenConversationOperationInput;
export type ListCustomerConversationsOperationInput =
  WithoutProject<ListCustomerConversationsInput>;
export type ListAgentInboxOperationInput = WithoutProject<ListAgentInboxInput>;
export type ListConversationMessagesOperationInput =
  WithoutProject<ListConversationMessagesInput>;
export type RecordMessageReadOperationInput =
  WithoutProject<RecordMessageReadInput>;
export type UpsertCustomerOperationInput = WithoutProject<UpsertCustomerInput>;
export type UpsertAgentOperationInput = WithoutProject<UpsertAgentInput>;
export type ConversationTagOperationInput =
  WithoutProject<ConversationTagInput>;

export interface SupportConversationOperations {
  create(
    input: CreateConversationOperationInput,
  ): Promise<CreateConversationResult>;
  sendMessage(input: SendMessageOperationInput): Promise<Message>;
  addInternalNote(input: AddInternalNoteOperationInput): Promise<Message>;
  assign(
    input: AssignConversationOperationInput,
  ): Promise<ConversationAssignment>;
  changeStatus(
    input: ChangeConversationStatusOperationInput,
  ): Promise<Conversation>;
  reopen(input: ReopenConversationOperationInput): Promise<Conversation>;
  markSpam(input: MarkConversationSpamOperationInput): Promise<Conversation>;
  listForCustomer(
    input: ListCustomerConversationsOperationInput,
  ): Promise<readonly Conversation[]>;
  listInbox(
    input: ListAgentInboxOperationInput,
  ): Promise<readonly Conversation[]>;
}

export interface SupportMessageOperations {
  list(
    input: ListConversationMessagesOperationInput,
  ): Promise<readonly Message[]>;
  recordRead(
    input: RecordMessageReadOperationInput,
  ): Promise<RecordMessageReadResult>;
}

export interface SupportCustomerOperations {
  upsert(input: UpsertCustomerOperationInput): Promise<Customer>;
}

export interface SupportAgentOperations {
  upsert(input: UpsertAgentOperationInput): Promise<Agent>;
}

export interface SupportTagOperations {
  add(input: ConversationTagOperationInput): Promise<void>;
  remove(input: ConversationTagOperationInput): Promise<void>;
}

export interface KnowledgeArticleCreateInput {
  readonly actor: AgentActor;
  readonly title: string;
  readonly sourceKey: string;
  readonly summary: string;
  readonly body: string;
  readonly tags?: readonly string[];
}
export interface KnowledgeArticleUpdateInput {
  readonly articleId: string;
  readonly actor: AgentActor;
  readonly patch: Partial<
    Pick<KnowledgeArticle, "title" | "summary" | "body" | "tags">
  >;
}
export interface KnowledgeArticleActionInput {
  readonly articleId: string;
  readonly actor: AgentActor;
}
export interface SupportKnowledgeOperations {
  create(input: KnowledgeArticleCreateInput): Promise<KnowledgeArticle>;
  update(input: KnowledgeArticleUpdateInput): Promise<KnowledgeArticle>;
  publish(input: KnowledgeArticleActionInput): Promise<KnowledgeArticle>;
  archive(input: KnowledgeArticleActionInput): Promise<KnowledgeArticle>;
  restore(input: KnowledgeArticleActionInput): Promise<KnowledgeArticle>;
  list(input: {
    readonly actor: AgentActor;
    readonly status?: KnowledgeArticle["status"];
  }): Promise<readonly KnowledgeArticle[]>;
  revisions(
    input: KnowledgeArticleActionInput,
  ): Promise<readonly KnowledgeArticleRevision[]>;
}
export interface ChatbotSessionInput {
  readonly actor: CustomerActor;
}
export interface ChatbotSessionActionInput extends ChatbotSessionInput {
  readonly sessionId: string;
}
export interface SupportChatbotOperations {
  start(input: ChatbotSessionInput): Promise<ChatbotSession>;
  get(input: ChatbotSessionActionInput): Promise<ChatbotSession>;
  turns(input: ChatbotSessionActionInput): Promise<readonly ChatbotTurn[]>;
  send(
    input: ChatbotSessionActionInput & {
      readonly message: string;
      readonly clientMessageId: string;
    },
  ): Promise<{ readonly userTurn: ChatbotTurn; readonly botTurn: ChatbotTurn }>;
  handoff(
    input: ChatbotSessionActionInput & { readonly reason: string },
  ): Promise<ChatbotHandoff>;
}

export interface CreateAttachmentUploadIntentOperationInput {
  readonly conversationId: string;
  readonly actor: CustomerActor | AgentActor;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly purpose?: "reply" | "internal_note";
}
export interface AttachmentOperationInput {
  readonly conversationId: string;
  readonly attachmentId: string;
  readonly actor: CustomerActor | AgentActor;
}
export interface SanitizedAttachment {
  readonly id: string;
  readonly fileName: string;
  readonly mediaType: string;
  readonly sizeBytes: number;
  readonly status: AttachmentMetadata["status"];
}
export interface SupportAttachmentOperations {
  createUploadIntent(
    input: CreateAttachmentUploadIntentOperationInput,
  ): Promise<{
    readonly attachment: SanitizedAttachment;
    readonly upload: {
      readonly method: "PUT";
      readonly url: string;
      readonly headers: Readonly<Record<string, string>>;
      readonly expiresAt: string;
    };
  }>;
  completeUpload(input: AttachmentOperationInput): Promise<SanitizedAttachment>;
  deletePending(input: AttachmentOperationInput): Promise<void>;
  getDownload(
    input: AttachmentOperationInput,
  ): Promise<{ readonly url: string; readonly expiresAt: string }>;
}

export interface SupportAuthOperations {
  resolveCustomer(
    context: SupportAuthContext,
  ): Promise<CustomerActor & { readonly type: "customer" }>;
  resolveVisitor(
    context: SupportAuthContext,
  ): Promise<CustomerActor & { readonly type: "visitor" }>;
  resolveAgent(
    context: SupportAuthContext,
  ): Promise<AgentActor & { readonly role: DefaultRole }>;
}

/** Sanitized post-commit notification exposed without application internals. */
export interface SupportCommittedEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly conversationId?: string;
  readonly occurredAt: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface SupportEventOperations {
  subscribe(
    listener: (event: SupportCommittedEvent) => void | Promise<void>,
  ): () => void;
}

export type HealthStatus = "healthy" | "degraded" | "unhealthy";
export type HealthCheckStatus =
  "healthy" | "unhealthy" | "unavailable" | "disabled";
export interface HealthCheckResult {
  readonly status: HealthCheckStatus;
  readonly message?: string;
}
export interface SupportKitHealth {
  readonly status: HealthStatus;
  readonly projectId: string;
  readonly checks: Readonly<{
    initialization: HealthCheckResult;
    project: HealthCheckResult;
    database: HealthCheckResult;
    auth: HealthCheckResult;
    realtime: HealthCheckResult;
    storage: HealthCheckResult;
    notifications: HealthCheckResult;
    ai: HealthCheckResult;
  }>;
}

/** Stable composed SDK surface. Repositories and use-case instances remain private. */
export interface SupportKit {
  readonly projectId: string;
  readonly conversations: SupportConversationOperations;
  readonly messages: SupportMessageOperations;
  readonly customers: SupportCustomerOperations;
  readonly agents: SupportAgentOperations;
  readonly tags: SupportTagOperations;
  readonly knowledge?: SupportKnowledgeOperations;
  readonly chatbot?: SupportChatbotOperations;
  readonly attachments: SupportAttachmentOperations;
  readonly auth: SupportAuthOperations;
  readonly events: SupportEventOperations;
  healthCheck(): Promise<SupportKitHealth>;
  dispose(): Promise<void>;
}

export type { Agent, Conversation, Customer, Message, Tag };
