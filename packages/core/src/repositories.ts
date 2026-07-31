import type {
  Agent,
  AttachmentMetadata,
  AuditEvent,
  Conversation,
  ConversationAssignment,
  ConversationParticipant,
  Customer,
  Message,
  MessageReceipt,
  Project,
  SavedReply,
  Tag,
} from "./entities.js";

/** Administrative project lookup boundary. Tenant repositories never accept project keys. */
export interface ProjectRepository {
  create(project: Project): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  findByKey(projectKey: string): Promise<Project | null>;
  updateMetadata(
    id: string,
    metadata: Readonly<Record<string, unknown>>,
    updatedAt: Date,
  ): Promise<Project>;
}

/** Project-scoped lookup input used by repository ports. */
export interface ProjectEntityKey {
  readonly projectId: string;
  readonly id: string;
}

/** Minimal persistence operations shared by domain repository ports. */
export interface SupportRepository<TEntity> {
  findById(key: ProjectEntityKey): Promise<TEntity | null>;
  save(entity: TEntity): Promise<TEntity>;
}

/** Project-scoped customer repository port. */
export interface CustomerRepository extends SupportRepository<Customer> {
  findByExternalId(
    projectId: string,
    externalCustomerId: string,
  ): Promise<Customer | null>;
}

/** Project-scoped agent repository port. */
export interface AgentRepository extends SupportRepository<Agent> {
  findByExternalId(
    projectId: string,
    externalAgentId: string,
  ): Promise<Agent | null>;
}

/** Project-scoped conversation repository port. */
export interface ConversationRepository extends SupportRepository<Conversation> {
  listByParticipant(
    projectId: string,
    participantType: ConversationParticipant["participantType"],
    participantId: string,
  ): Promise<readonly Conversation[]>;
  listInbox(
    projectId: string,
    agentId?: string,
  ): Promise<readonly Conversation[]>;
}

/** Project-scoped conversation participant repository port. */
export interface ConversationParticipantRepository extends SupportRepository<ConversationParticipant> {
  findParticipant(
    projectId: string,
    conversationId: string,
    participantType: ConversationParticipant["participantType"],
    participantId: string,
  ): Promise<ConversationParticipant | null>;
}

/** Project-scoped assignment repository port. */
export interface ConversationAssignmentRepository extends SupportRepository<ConversationAssignment> {
  findActive(
    projectId: string,
    conversationId: string,
  ): Promise<ConversationAssignment | null>;
}

/** Project-scoped message repository port. */
export interface MessageRepository extends SupportRepository<Message> {
  findByClientMessageId(
    projectId: string,
    conversationId: string,
    clientMessageId: string,
  ): Promise<Message | null>;
  listByConversation(
    projectId: string,
    conversationId: string,
  ): Promise<readonly Message[]>;
}

/** Project-scoped message receipt repository port. */
export interface MessageReceiptRepository {
  findByMessageAndReader(
    projectId: string,
    messageId: string,
    readerType: MessageReceipt["readerType"],
    readerId: string,
  ): Promise<MessageReceipt | null>;
  create(receipt: MessageReceipt): Promise<MessageReceipt>;
}

/** Project-scoped attachment repository port. */
export type AttachmentRepository = SupportRepository<AttachmentMetadata>;
/** Project-scoped tag repository port. */
export type TagRepository = SupportRepository<Tag>;

/** Project-scoped conversation-tag association repository port. */
export interface ConversationTagRepository {
  add(projectId: string, conversationId: string, tagId: string): Promise<void>;
  remove(
    projectId: string,
    conversationId: string,
    tagId: string,
  ): Promise<void>;
}

/** Project-scoped saved-reply repository port. */
export type SavedReplyRepository = SupportRepository<SavedReply>;

/** Project-scoped append-only audit repository port. */
export interface AuditRepository {
  append(event: AuditEvent): Promise<void>;
}

/** Minimal provider-independent database boundary used by application services. */
export interface SupportDatabaseAdapter {
  readonly projects: ProjectRepository;
  readonly customers: CustomerRepository;
  readonly agents: AgentRepository;
  readonly conversations: ConversationRepository;
  readonly participants: ConversationParticipantRepository;
  readonly assignments: ConversationAssignmentRepository;
  readonly messages: MessageRepository;
  readonly messageReceipts: MessageReceiptRepository;
  readonly attachments: AttachmentRepository;
  readonly tags: TagRepository;
  readonly conversationTags: ConversationTagRepository;
  readonly savedReplies: SavedReplyRepository;
  readonly audit: AuditRepository;
  transaction<TResult>(
    operation: (database: SupportDatabaseAdapter) => Promise<TResult>,
  ): Promise<TResult>;
}
