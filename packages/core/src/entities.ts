import type {
  ConversationStatus,
  DefaultRole,
  MessageDeliveryStatus,
  MessageType,
  SenderType,
  SupportPermission,
} from "./values.js";

/** Common fields for a project-scoped domain entity. */
export interface ProjectScopedEntity {
  readonly id: string;
  readonly projectId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A host application installation boundary. */
export interface Project {
  readonly id: string;
  /** Unique installation-facing identifier; never used as a foreign key. */
  readonly projectKey: string;
  readonly name: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A customer backed by an identity from the host application. */
export interface Customer extends ProjectScopedEntity {
  readonly externalCustomerId: string;
  readonly name?: string;
  readonly email?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/** An unauthenticated visitor represented by a verified support session. */
export interface AnonymousVisitor extends ProjectScopedEntity {
  readonly externalVisitorId: string;
  readonly sessionId?: string;
  readonly name?: string;
  readonly email?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly lastSeenAt: Date;
}

/** A support agent backed by an identity from the host application. */
export interface Agent extends ProjectScopedEntity {
  readonly externalAgentId: string;
  readonly name: string;
  readonly email?: string;
  readonly role: DefaultRole;
  readonly permissions: readonly SupportPermission[];
}

/** A support conversation and its lifecycle state. */
export interface Conversation extends ProjectScopedEntity {
  readonly status: ConversationStatus;
  readonly subject?: string;
  readonly priority?: "low" | "normal" | "high" | "urgent";
}

/** A customer, visitor, or agent participating in a conversation. */
export interface ConversationParticipant extends ProjectScopedEntity {
  readonly conversationId: string;
  readonly participantId: string;
  readonly participantType: "customer" | "visitor" | "agent";
}

/** An agent assignment recorded for a conversation. */
export interface ConversationAssignment extends ProjectScopedEntity {
  readonly conversationId: string;
  readonly agentId: string;
  readonly assignedByAgentId?: string;
  readonly unassignedAt?: Date;
}

/** A message persisted within a conversation. */
export interface Message extends ProjectScopedEntity {
  readonly conversationId: string;
  readonly clientMessageId?: string;
  readonly type: MessageType;
  readonly senderType: SenderType;
  readonly senderId?: string;
  readonly body: string;
  readonly deliveryStatus: MessageDeliveryStatus;
  readonly attachments?: readonly AttachmentMetadata[];
}

/** A durable record that one actor has read one message. */
export interface MessageReceipt extends ProjectScopedEntity {
  readonly messageId: string;
  readonly conversationId: string;
  readonly readerType: "customer" | "visitor" | "agent";
  readonly readerId: string;
  readonly readAt: Date;
}

/** Safe metadata describing an attachment without provider details. */
export interface AttachmentMetadata extends ProjectScopedEntity {
  readonly conversationId: string;
  readonly messageId?: string;
  readonly uploaderType: SenderType;
  readonly uploaderId: string;
  readonly visibility: "public" | "internal_note";
  /** Opaque provider key. This field is never serialized to browsers. */
  readonly storageKey: string;
  readonly originalFilename: string;
  readonly safeDisplayFilename: string;
  readonly claimedMimeType: string;
  readonly detectedMimeType?: string;
  readonly sizeBytes: number;
  readonly checksumSha256?: string;
  readonly status: AttachmentStatus;
  readonly scanStatus: AttachmentScanStatus;
  readonly rejectionReasonCode?: string;
  readonly uploadedAt?: Date;
  readonly uploadExpiresAt?: Date;
  readonly scannedAt?: Date;
  readonly attachedAt?: Date;
  readonly deletedAt?: Date;
}

export type AttachmentStatus =
  | "pending_upload"
  | "uploaded"
  | "scanning"
  | "ready"
  | "rejected"
  | "failed"
  | "deleted";

export type AttachmentScanStatus =
  "pending" | "clean" | "infected" | "suspicious" | "failed" | "skipped";

/** A label that may be associated with conversations. */
export interface Tag extends ProjectScopedEntity {
  readonly name: string;
  readonly color?: string;
}

/** A reusable support-agent reply. */
export interface SavedReply extends ProjectScopedEntity {
  readonly title: string;
  readonly body: string;
  readonly createdByAgentId: string;
}

export type KnowledgeArticleStatus = "draft" | "published" | "archived";

export interface KnowledgeArticle extends ProjectScopedEntity {
  readonly title: string;
  readonly sourceKey: string;
  readonly summary: string;
  readonly body: string;
  readonly status: KnowledgeArticleStatus;
  readonly revisionNumber: number;
  readonly activeRevisionNumber?: number;
  readonly tags: readonly string[];
  readonly createdByAgentId: string;
  readonly updatedByAgentId: string;
  readonly publishedAt?: Date;
  readonly archivedAt?: Date;
}

export interface KnowledgeArticleRevision extends ProjectScopedEntity {
  readonly articleId: string;
  readonly revisionNumber: number;
  readonly title: string;
  readonly summary: string;
  readonly body: string;
  readonly createdByAgentId: string;
}

export interface KnowledgeChunk extends ProjectScopedEntity {
  readonly articleId: string;
  readonly revisionNumber: number;
  readonly chunkIndex: number;
  readonly sourceKey: string;
  readonly title: string;
  readonly section?: string;
  readonly content: string;
  readonly characterCount: number;
  readonly checksum: string;
}

export interface ChatbotSession extends ProjectScopedEntity {
  readonly actorType: "customer" | "visitor";
  readonly actorId: string;
  readonly status: "active" | "handed_off";
  readonly conversationId?: string;
  readonly turnCount: number;
  readonly handedOffAt?: Date;
}

export interface ChatbotCitation {
  readonly sourceKey: string;
  readonly articleTitle: string;
  readonly section?: string;
  readonly excerpt?: string;
  readonly publicUrl?: string;
}

export interface ChatbotTurn extends ProjectScopedEntity {
  readonly sessionId: string;
  readonly actorType: "customer" | "visitor" | "bot";
  readonly clientMessageId?: string;
  readonly content: string;
  readonly citations: readonly ChatbotCitation[];
  readonly outcome: "answered" | "insufficient_knowledge" | "ai_failed";
  readonly modelReference?: string;
}

export interface ChatbotHandoff extends ProjectScopedEntity {
  readonly sessionId: string;
  readonly conversationId: string;
  readonly reason: string;
  readonly summary: string;
  readonly unresolvedQuestions: readonly string[];
  readonly citedSourceKeys: readonly string[];
  readonly requestedAt: Date;
}

/** An immutable record of a security- or business-relevant domain action. */
export interface AuditEvent extends ProjectScopedEntity {
  readonly action: string;
  readonly actorId?: string;
  readonly actorType: SenderType;
  readonly resourceId?: string;
  readonly resourceType: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}
