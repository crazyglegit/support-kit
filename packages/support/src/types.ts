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
} from "@crazyglegit/support-core";
import type {
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

export interface SupportAuthOperations {
  resolveCustomer(
    context: SupportAuthContext,
  ): Promise<CustomerActor & { readonly type: "customer" }>;
  resolveVisitor(
    context: SupportAuthContext,
  ): Promise<CustomerActor & { readonly type: "visitor" }>;
  resolveAgent(context: SupportAuthContext): Promise<AgentActor>;
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
  readonly auth: SupportAuthOperations;
  healthCheck(): Promise<SupportKitHealth>;
  dispose(): Promise<void>;
}

export type { Agent, Conversation, Customer, Message, Tag };
