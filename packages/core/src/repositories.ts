import type {
  Agent,
  AttachmentMetadata,
  AuditEvent,
  Conversation,
  ConversationAssignment,
  Customer,
  Message,
  SavedReply,
  Tag,
} from "./entities.js";

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
export type CustomerRepository = SupportRepository<Customer>;
/** Project-scoped agent repository port. */
export type AgentRepository = SupportRepository<Agent>;
/** Project-scoped conversation repository port. */
export type ConversationRepository = SupportRepository<Conversation>;
/** Project-scoped assignment repository port. */
export type ConversationAssignmentRepository =
  SupportRepository<ConversationAssignment>;
/** Project-scoped message repository port. */
export type MessageRepository = SupportRepository<Message>;
/** Project-scoped attachment repository port. */
export type AttachmentRepository = SupportRepository<AttachmentMetadata>;
/** Project-scoped tag repository port. */
export type TagRepository = SupportRepository<Tag>;
/** Project-scoped saved-reply repository port. */
export type SavedReplyRepository = SupportRepository<SavedReply>;
/** Project-scoped append-only audit repository port. */
export interface AuditRepository {
  append(event: AuditEvent): Promise<void>;
}

/** Minimal provider-independent database boundary used by the core services. */
export interface SupportDatabaseAdapter {
  readonly customers: CustomerRepository;
  readonly agents: AgentRepository;
  readonly conversations: ConversationRepository;
  readonly assignments: ConversationAssignmentRepository;
  readonly messages: MessageRepository;
  readonly attachments: AttachmentRepository;
  readonly tags: TagRepository;
  readonly savedReplies: SavedReplyRepository;
  readonly audit: AuditRepository;
  transaction<TResult>(
    operation: (database: SupportDatabaseAdapter) => Promise<TResult>,
  ): Promise<TResult>;
}
