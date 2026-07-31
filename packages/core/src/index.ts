export {
  CONVERSATION_STATUSES,
  DEFAULT_ROLES,
  MESSAGE_DELIVERY_STATUSES,
  MESSAGE_TYPES,
  SENDER_TYPES,
  SUPPORT_PERMISSIONS,
} from "./values.js";
export type {
  ConversationStatus,
  DefaultRole,
  MessageDeliveryStatus,
  MessageType,
  SenderType,
  SupportPermission,
} from "./values.js";
export type {
  Agent,
  AnonymousVisitor,
  AttachmentMetadata,
  AuditEvent,
  Conversation,
  ConversationAssignment,
  ConversationParticipant,
  Customer,
  Message,
  MessageReceipt,
  Project,
  ProjectScopedEntity,
  SavedReply,
  Tag,
} from "./entities.js";
export {
  assertConversationTransition,
  canTransitionConversation,
  isActiveConversationStatus,
  isTerminalConversationStatus,
} from "./conversations.js";
export {
  createDomainError,
  DOMAIN_ERROR_CODES,
  DomainError,
  isDomainError,
} from "./errors.js";
export type { DomainErrorCode } from "./errors.js";
export {
  assertValidClientMessageId,
  findDuplicateClientMessageIds,
  isCustomerVisibleMessage,
  isCustomerVisibleMessageType,
  isValidClientMessageId,
} from "./messages.js";
export {
  hasAnyPermission,
  hasEveryPermission,
  hasPermission,
} from "./permissions.js";
export type {
  AgentRepository,
  AttachmentRepository,
  AuditRepository,
  ConversationAssignmentRepository,
  ConversationParticipantRepository,
  ConversationRepository,
  ConversationTagRepository,
  CustomerRepository,
  MessageRepository,
  MessageReceiptRepository,
  ProjectRepository,
  ProjectEntityKey,
  SavedReplyRepository,
  SupportDatabaseAdapter,
  SupportRepository,
  TagRepository,
  VisitorRepository,
} from "./repositories.js";
