import {
  and,
  desc,
  asc,
  eq,
  getTableColumns,
  isNull,
  sql,
  type SQL,
} from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import {
  DomainError,
  isDomainError,
  type Agent,
  type AnonymousVisitor,
  type AttachmentMetadata,
  type AuditEvent,
  type Conversation,
  type ConversationAssignment,
  type ConversationParticipant,
  type Customer,
  type Message,
  type MessageReceipt,
  type Project,
  type SavedReply,
  type SupportDatabaseAdapter,
  type Tag,
  type KnowledgeArticle,
  type KnowledgeArticleRevision,
  type KnowledgeChunk,
  type ChatbotSession,
  type ChatbotTurn,
  type ChatbotHandoff,
} from "@crazyglegit/support-core";
import * as schema from "./schema.js";

type Database = PostgresJsDatabase<typeof schema>;

/** Options for constructing the PostgreSQL persistence adapter. */
export type DrizzleSupportDatabaseOptions =
  | { readonly connectionString: string; readonly maxConnections?: number }
  | { readonly client: Sql };

function mapProject(row: typeof schema.projects.$inferSelect): Project {
  return {
    id: row.id,
    projectKey: row.projectKey,
    name: row.name,
    metadata: row.metadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
function mapCustomer(row: typeof schema.customers.$inferSelect): Customer {
  return {
    id: row.id,
    projectId: row.projectId,
    externalCustomerId: row.externalCustomerId,
    ...(row.name === null ? {} : { name: row.name }),
    ...(row.email === null ? {} : { email: row.email }),
    metadata: row.metadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
function mapVisitor(
  row: typeof schema.visitors.$inferSelect,
): AnonymousVisitor {
  return {
    id: row.id,
    projectId: row.projectId,
    externalVisitorId: row.externalVisitorId,
    ...(row.sessionId === null ? {} : { sessionId: row.sessionId }),
    ...(row.name === null ? {} : { name: row.name }),
    ...(row.email === null ? {} : { email: row.email }),
    metadata: row.metadata,
    lastSeenAt: row.lastSeenAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
function mapAgent(row: typeof schema.agents.$inferSelect): Agent {
  return {
    id: row.id,
    projectId: row.projectId,
    externalAgentId: row.externalAgentId,
    name: row.name,
    ...(row.email === null ? {} : { email: row.email }),
    role: row.role as Agent["role"],
    permissions: row.permissions as Agent["permissions"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
function mapConversation(
  row: typeof schema.conversations.$inferSelect,
): Conversation {
  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status,
    ...(row.subject === null ? {} : { subject: row.subject }),
    ...(row.priority === null
      ? {}
      : { priority: row.priority as NonNullable<Conversation["priority"]> }),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
function mapParticipant(
  row: typeof schema.conversationParticipants.$inferSelect,
): ConversationParticipant {
  return {
    id: row.id,
    projectId: row.projectId,
    conversationId: row.conversationId,
    participantId: row.participantId,
    participantType: row.participantType,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
function mapAssignment(
  row: typeof schema.conversationAssignments.$inferSelect,
): ConversationAssignment {
  return {
    id: row.id,
    projectId: row.projectId,
    conversationId: row.conversationId,
    agentId: row.agentId,
    ...(row.assignedByAgentId === null
      ? {}
      : { assignedByAgentId: row.assignedByAgentId }),
    ...(row.unassignedAt === null ? {} : { unassignedAt: row.unassignedAt }),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
function mapMessage(row: typeof schema.messages.$inferSelect): Message {
  return {
    id: row.id,
    projectId: row.projectId,
    conversationId: row.conversationId,
    ...(row.clientMessageId === null
      ? {}
      : { clientMessageId: row.clientMessageId }),
    type: row.type,
    senderType: row.senderType,
    ...(row.senderId === null ? {} : { senderId: row.senderId }),
    body: row.body,
    deliveryStatus: row.deliveryStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
function mapReceipt(
  row: typeof schema.messageReceipts.$inferSelect,
): MessageReceipt {
  return {
    id: row.id,
    projectId: row.projectId,
    messageId: row.messageId,
    conversationId: row.conversationId,
    readerType: row.readerType,
    readerId: row.readerId,
    readAt: row.readAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
function mapAttachment(
  row: typeof schema.attachments.$inferSelect,
): AttachmentMetadata {
  return {
    id: row.id,
    projectId: row.projectId,
    conversationId: row.conversationId,
    ...(row.messageId === null ? {} : { messageId: row.messageId }),
    uploaderType: row.uploaderType,
    uploaderId: row.uploaderId,
    visibility: row.visibility,
    storageKey: row.storageKey,
    originalFilename: row.originalFilename,
    safeDisplayFilename: row.safeDisplayFilename,
    claimedMimeType: row.claimedMimeType,
    ...(row.detectedMimeType === null
      ? {}
      : { detectedMimeType: row.detectedMimeType }),
    sizeBytes: row.sizeBytes,
    ...(row.checksumSha256 === null
      ? {}
      : { checksumSha256: row.checksumSha256 }),
    status: row.status,
    scanStatus: row.scanStatus,
    ...(row.rejectionReasonCode === null
      ? {}
      : { rejectionReasonCode: row.rejectionReasonCode }),
    ...(row.uploadedAt === null ? {} : { uploadedAt: row.uploadedAt }),
    ...(row.uploadExpiresAt === null
      ? {}
      : { uploadExpiresAt: row.uploadExpiresAt }),
    ...(row.scannedAt === null ? {} : { scannedAt: row.scannedAt }),
    ...(row.attachedAt === null ? {} : { attachedAt: row.attachedAt }),
    ...(row.deletedAt === null ? {} : { deletedAt: row.deletedAt }),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
function mapTag(row: typeof schema.tags.$inferSelect): Tag {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    ...(row.color === null ? {} : { color: row.color }),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
function mapSavedReply(
  row: typeof schema.savedReplies.$inferSelect,
): SavedReply {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    body: row.body,
    createdByAgentId: row.createdByAgentId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
function mapKnowledgeArticle(
  row: typeof schema.knowledgeArticles.$inferSelect,
): KnowledgeArticle {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    sourceKey: row.sourceKey,
    summary: row.summary,
    body: row.body,
    status: row.status,
    revisionNumber: row.revisionNumber,
    ...(row.activeRevisionNumber === null
      ? {}
      : { activeRevisionNumber: row.activeRevisionNumber }),
    tags: row.tags,
    createdByAgentId: row.createdByAgentId,
    updatedByAgentId: row.updatedByAgentId,
    ...(row.publishedAt === null ? {} : { publishedAt: row.publishedAt }),
    ...(row.archivedAt === null ? {} : { archivedAt: row.archivedAt }),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
function mapKnowledgeRevision(
  row: typeof schema.knowledgeRevisions.$inferSelect,
): KnowledgeArticleRevision {
  return {
    id: row.id,
    projectId: row.projectId,
    articleId: row.articleId,
    revisionNumber: row.revisionNumber,
    title: row.title,
    summary: row.summary,
    body: row.body,
    createdByAgentId: row.createdByAgentId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
function mapKnowledgeChunk(
  row: typeof schema.knowledgeChunks.$inferSelect,
): KnowledgeChunk {
  return {
    id: row.id,
    projectId: row.projectId,
    articleId: row.articleId,
    revisionNumber: row.revisionNumber,
    chunkIndex: row.chunkIndex,
    sourceKey: row.sourceKey,
    title: row.title,
    ...(row.section === null ? {} : { section: row.section }),
    content: row.content,
    characterCount: row.characterCount,
    checksum: row.checksum,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
function mapChatbotSession(
  row: typeof schema.chatbotSessions.$inferSelect,
): ChatbotSession {
  if (row.actorType === "agent")
    throw new DomainError(
      "VALIDATION_ERROR",
      "Chatbot sessions cannot belong to agents.",
    );
  return {
    id: row.id,
    projectId: row.projectId,
    actorType: row.actorType,
    actorId: row.actorId,
    status: row.status,
    ...(row.conversationId === null
      ? {}
      : { conversationId: row.conversationId }),
    turnCount: row.turnCount,
    ...(row.handedOffAt === null ? {} : { handedOffAt: row.handedOffAt }),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
function mapChatbotTurn(
  row: typeof schema.chatbotTurns.$inferSelect,
): ChatbotTurn {
  return {
    id: row.id,
    projectId: row.projectId,
    sessionId: row.sessionId,
    actorType: row.actorType,
    ...(row.clientMessageId === null
      ? {}
      : { clientMessageId: row.clientMessageId }),
    content: row.content,
    citations: row.citations,
    outcome: row.outcome,
    ...(row.modelReference === null
      ? {}
      : { modelReference: row.modelReference }),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
function mapChatbotHandoff(
  row: typeof schema.chatbotHandoffs.$inferSelect,
): ChatbotHandoff {
  return {
    id: row.id,
    projectId: row.projectId,
    sessionId: row.sessionId,
    conversationId: row.conversationId,
    reason: row.reason,
    summary: row.summary,
    unresolvedQuestions: row.unresolvedQuestions,
    citedSourceKeys: row.citedSourceKeys,
    requestedAt: row.requestedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Converts provider failures to the stable error vocabulary. Internal to this package. */
export function throwSanitizedDatabaseError(error: unknown): never {
  if (isDomainError(error)) throw error;
  let candidate: unknown = error;
  let code = "";
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof candidate !== "object" || candidate === null) break;
    if ("code" in candidate && typeof candidate.code === "string") {
      code = candidate.code;
      break;
    }
    candidate = "cause" in candidate ? candidate.cause : undefined;
  }
  if (code === "23505")
    throw new DomainError(
      "CONFLICT",
      "The record conflicts with existing support data.",
    );
  if (code === "23503")
    throw new DomainError(
      "NOT_FOUND",
      "A referenced support record was not found.",
    );
  if (code === "23502" || code === "22P02" || code === "23514")
    throw new DomainError("VALIDATION_ERROR", "The support record is invalid.");
  throw new DomainError("INTERNAL_ERROR", "The database operation failed.");
}

function missingResult(): never {
  throw new DomainError("INTERNAL_ERROR", "The database operation failed.");
}

async function safe<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    return throwSanitizedDatabaseError(error);
  }
}

function createAdapter(db: Database): SupportDatabaseAdapter {
  const adapter: SupportDatabaseAdapter = {
    projects: {
      create: (project) =>
        safe(async () => {
          const [row] = await db
            .insert(schema.projects)
            .values(project)
            .returning();
          if (!row) return missingResult();
          return mapProject(row);
        }),
      findById: (id) =>
        safe(async () => {
          const [row] = await db
            .select()
            .from(schema.projects)
            .where(eq(schema.projects.id, id))
            .limit(1);
          return row ? mapProject(row) : null;
        }),
      findByKey: (key) =>
        safe(async () => {
          const [row] = await db
            .select()
            .from(schema.projects)
            .where(eq(schema.projects.projectKey, key))
            .limit(1);
          return row ? mapProject(row) : null;
        }),
      updateMetadata: (id, metadata, updatedAt) =>
        safe(async () => {
          const [row] = await db
            .update(schema.projects)
            .set({ metadata, updatedAt })
            .where(eq(schema.projects.id, id))
            .returning();
          if (!row)
            throw new DomainError("NOT_FOUND", "Project was not found.");
          return mapProject(row);
        }),
    },
    customers: {
      findById: ({ projectId, id }) =>
        safe(async () => {
          const [row] = await db
            .select()
            .from(schema.customers)
            .where(
              and(
                eq(schema.customers.projectId, projectId),
                eq(schema.customers.id, id),
              ),
            )
            .limit(1);
          return row ? mapCustomer(row) : null;
        }),
      findByExternalId: (projectId, externalId) =>
        safe(async () => {
          const [row] = await db
            .select()
            .from(schema.customers)
            .where(
              and(
                eq(schema.customers.projectId, projectId),
                eq(schema.customers.externalCustomerId, externalId),
              ),
            )
            .limit(1);
          return row ? mapCustomer(row) : null;
        }),
      save: (entity) =>
        safe(async () => {
          const [row] = await db
            .insert(schema.customers)
            .values(entity)
            .onConflictDoUpdate({
              target: [
                schema.customers.projectId,
                schema.customers.externalCustomerId,
              ],
              set: {
                name: entity.name ?? null,
                email: entity.email ?? null,
                metadata: entity.metadata,
                updatedAt: entity.updatedAt,
              },
            })
            .returning();
          if (!row) return missingResult();
          return mapCustomer(row);
        }),
    },
    agents: {
      findById: ({ projectId, id }) =>
        safe(async () => {
          const [row] = await db
            .select()
            .from(schema.agents)
            .where(
              and(
                eq(schema.agents.projectId, projectId),
                eq(schema.agents.id, id),
              ),
            )
            .limit(1);
          return row ? mapAgent(row) : null;
        }),
      findByExternalId: (projectId, externalId) =>
        safe(async () => {
          const [row] = await db
            .select()
            .from(schema.agents)
            .where(
              and(
                eq(schema.agents.projectId, projectId),
                eq(schema.agents.externalAgentId, externalId),
              ),
            )
            .limit(1);
          return row ? mapAgent(row) : null;
        }),
      save: (entity) =>
        safe(async () => {
          const [row] = await db
            .insert(schema.agents)
            .values({ ...entity, permissions: entity.permissions })
            .onConflictDoUpdate({
              target: [schema.agents.projectId, schema.agents.externalAgentId],
              set: {
                name: entity.name,
                email: entity.email ?? null,
                role: entity.role,
                permissions: entity.permissions,
                updatedAt: entity.updatedAt,
              },
            })
            .returning();
          if (!row) return missingResult();
          return mapAgent(row);
        }),
    },
    visitors: {
      findById: ({ projectId, id }) =>
        safe(async () => {
          const [row] = await db
            .select()
            .from(schema.visitors)
            .where(
              and(
                eq(schema.visitors.projectId, projectId),
                eq(schema.visitors.id, id),
              ),
            )
            .limit(1);
          return row ? mapVisitor(row) : null;
        }),
      findByExternalId: (projectId, externalVisitorId) =>
        safe(async () => {
          const [row] = await db
            .select()
            .from(schema.visitors)
            .where(
              and(
                eq(schema.visitors.projectId, projectId),
                eq(schema.visitors.externalVisitorId, externalVisitorId),
              ),
            )
            .limit(1);
          return row ? mapVisitor(row) : null;
        }),
      save: (entity) =>
        safe(async () => {
          const [row] = await db
            .insert(schema.visitors)
            .values(entity)
            .onConflictDoUpdate({
              target: [
                schema.visitors.projectId,
                schema.visitors.externalVisitorId,
              ],
              set: {
                sessionId: entity.sessionId ?? null,
                name: entity.name ?? null,
                email: entity.email ?? null,
                metadata: entity.metadata,
                lastSeenAt: entity.lastSeenAt,
                updatedAt: entity.updatedAt,
              },
            })
            .returning();
          if (!row) return missingResult();
          return mapVisitor(row);
        }),
    },
    conversations: {
      findById: ({ projectId, id }) =>
        safe(async () => {
          const [row] = await db
            .select()
            .from(schema.conversations)
            .where(
              and(
                eq(schema.conversations.projectId, projectId),
                eq(schema.conversations.id, id),
              ),
            )
            .limit(1);
          return row ? mapConversation(row) : null;
        }),
      save: (entity) =>
        safe(async () => {
          const [row] = await db
            .insert(schema.conversations)
            .values(entity)
            .onConflictDoUpdate({
              target: schema.conversations.id,
              set: {
                status: entity.status,
                subject: entity.subject ?? null,
                priority: entity.priority ?? null,
                updatedAt: entity.updatedAt,
              },
              setWhere: eq(schema.conversations.projectId, entity.projectId),
            })
            .returning();
          if (!row)
            throw new DomainError("NOT_FOUND", "Conversation was not found.");
          return mapConversation(row);
        }),
      listByParticipant: (projectId, participantType, participantId) =>
        safe(async () =>
          (
            await db
              .select(getTableColumns(schema.conversations))
              .from(schema.conversations)
              .innerJoin(
                schema.conversationParticipants,
                and(
                  eq(schema.conversationParticipants.projectId, projectId),
                  eq(
                    schema.conversationParticipants.conversationId,
                    schema.conversations.id,
                  ),
                ),
              )
              .where(
                and(
                  eq(schema.conversations.projectId, projectId),
                  eq(
                    schema.conversationParticipants.participantType,
                    participantType,
                  ),
                  eq(
                    schema.conversationParticipants.participantId,
                    participantId,
                  ),
                ),
              )
              .orderBy(desc(schema.conversations.updatedAt))
          ).map(mapConversation),
        ),
      listInbox: (projectId, agentId) =>
        safe(async () => {
          const base: SQL[] = [eq(schema.conversations.projectId, projectId)];
          if (agentId)
            base.push(eq(schema.conversationAssignments.agentId, agentId));
          const rows = await db
            .select(getTableColumns(schema.conversations))
            .from(schema.conversations)
            .leftJoin(
              schema.conversationAssignments,
              and(
                eq(schema.conversationAssignments.projectId, projectId),
                eq(
                  schema.conversationAssignments.conversationId,
                  schema.conversations.id,
                ),
                isNull(schema.conversationAssignments.unassignedAt),
              ),
            )
            .where(and(...base))
            .orderBy(desc(schema.conversations.updatedAt));
          return rows.map(mapConversation);
        }),
    },
    participants: {
      findById: ({ projectId, id }) =>
        safe(async () => {
          const [row] = await db
            .select()
            .from(schema.conversationParticipants)
            .where(
              and(
                eq(schema.conversationParticipants.projectId, projectId),
                eq(schema.conversationParticipants.id, id),
              ),
            )
            .limit(1);
          return row ? mapParticipant(row) : null;
        }),
      findParticipant: (
        projectId,
        conversationId,
        participantType,
        participantId,
      ) =>
        safe(async () => {
          const [row] = await db
            .select()
            .from(schema.conversationParticipants)
            .where(
              and(
                eq(schema.conversationParticipants.projectId, projectId),
                eq(
                  schema.conversationParticipants.conversationId,
                  conversationId,
                ),
                eq(
                  schema.conversationParticipants.participantType,
                  participantType,
                ),
                eq(
                  schema.conversationParticipants.participantId,
                  participantId,
                ),
              ),
            )
            .limit(1);
          return row ? mapParticipant(row) : null;
        }),
      save: (entity) =>
        safe(async () => {
          const [row] = await db
            .insert(schema.conversationParticipants)
            .values(entity)
            .onConflictDoNothing()
            .returning();
          if (row) return mapParticipant(row);
          const existing = await adapter.participants.findParticipant(
            entity.projectId,
            entity.conversationId,
            entity.participantType,
            entity.participantId,
          );
          if (!existing) return missingResult();
          return existing;
        }),
    },
    assignments: {
      findById: ({ projectId, id }) =>
        safe(async () => {
          const [row] = await db
            .select()
            .from(schema.conversationAssignments)
            .where(
              and(
                eq(schema.conversationAssignments.projectId, projectId),
                eq(schema.conversationAssignments.id, id),
              ),
            )
            .limit(1);
          return row ? mapAssignment(row) : null;
        }),
      findActive: (projectId, conversationId) =>
        safe(async () => {
          const [row] = await db
            .select()
            .from(schema.conversationAssignments)
            .where(
              and(
                eq(schema.conversationAssignments.projectId, projectId),
                eq(
                  schema.conversationAssignments.conversationId,
                  conversationId,
                ),
                isNull(schema.conversationAssignments.unassignedAt),
              ),
            )
            .limit(1);
          return row ? mapAssignment(row) : null;
        }),
      save: (entity) =>
        safe(async () => {
          const existing = await adapter.assignments.findById({
            projectId: entity.projectId,
            id: entity.id,
          });
          if (existing) {
            if (
              existing.conversationId !== entity.conversationId ||
              existing.agentId !== entity.agentId ||
              existing.assignedByAgentId !== entity.assignedByAgentId ||
              !entity.unassignedAt
            )
              throw new DomainError(
                "CONFLICT",
                "Assignment history is immutable.",
              );
            const [row] = await db
              .update(schema.conversationAssignments)
              .set({
                unassignedAt: entity.unassignedAt,
                updatedAt: entity.updatedAt,
              })
              .where(
                and(
                  eq(
                    schema.conversationAssignments.projectId,
                    entity.projectId,
                  ),
                  eq(schema.conversationAssignments.id, entity.id),
                  isNull(schema.conversationAssignments.unassignedAt),
                ),
              )
              .returning();
            if (!row)
              throw new DomainError(
                "CONFLICT",
                "Assignment history is immutable.",
              );
            return mapAssignment(row);
          }
          const [row] = await db
            .insert(schema.conversationAssignments)
            .values(entity)
            .returning();
          if (!row) return missingResult();
          return mapAssignment(row);
        }),
    },
    messages: {
      findById: ({ projectId, id }) =>
        safe(async () => {
          const [row] = await db
            .select()
            .from(schema.messages)
            .where(
              and(
                eq(schema.messages.projectId, projectId),
                eq(schema.messages.id, id),
              ),
            )
            .limit(1);
          return row ? mapMessage(row) : null;
        }),
      findByClientMessageId: (projectId, conversationId, clientMessageId) =>
        safe(async () => {
          const [row] = await db
            .select()
            .from(schema.messages)
            .where(
              and(
                eq(schema.messages.projectId, projectId),
                eq(schema.messages.conversationId, conversationId),
                eq(schema.messages.clientMessageId, clientMessageId),
              ),
            )
            .limit(1);
          return row ? mapMessage(row) : null;
        }),
      listByConversation: (projectId, conversationId) =>
        safe(async () =>
          (
            await db
              .select()
              .from(schema.messages)
              .where(
                and(
                  eq(schema.messages.projectId, projectId),
                  eq(schema.messages.conversationId, conversationId),
                ),
              )
              .orderBy(schema.messages.createdAt, schema.messages.id)
          ).map(mapMessage),
        ),
      save: (entity) =>
        safe(async () => {
          const [row] = await db
            .insert(schema.messages)
            .values(entity)
            .onConflictDoUpdate({
              target: schema.messages.id,
              set: {
                deliveryStatus: entity.deliveryStatus,
                updatedAt: entity.updatedAt,
              },
              setWhere: eq(schema.messages.projectId, entity.projectId),
            })
            .returning();
          if (!row)
            throw new DomainError("NOT_FOUND", "Message was not found.");
          return mapMessage(row);
        }),
    },
    messageReceipts: {
      findByMessageAndReader: (projectId, messageId, readerType, readerId) =>
        safe(async () => {
          const [row] = await db
            .select()
            .from(schema.messageReceipts)
            .where(
              and(
                eq(schema.messageReceipts.projectId, projectId),
                eq(schema.messageReceipts.messageId, messageId),
                eq(schema.messageReceipts.readerType, readerType),
                eq(schema.messageReceipts.readerId, readerId),
              ),
            )
            .limit(1);
          return row ? mapReceipt(row) : null;
        }),
      create: (entity) =>
        safe(async () => {
          const [row] = await db
            .insert(schema.messageReceipts)
            .values(entity)
            .onConflictDoNothing()
            .returning();
          if (row) return mapReceipt(row);
          const existing = await adapter.messageReceipts.findByMessageAndReader(
            entity.projectId,
            entity.messageId,
            entity.readerType,
            entity.readerId,
          );
          if (!existing) return missingResult();
          return existing;
        }),
    },
    attachments: {
      findById: ({ projectId, id }) =>
        safe(async () => {
          const [row] = await db
            .select()
            .from(schema.attachments)
            .where(
              and(
                eq(schema.attachments.projectId, projectId),
                eq(schema.attachments.id, id),
              ),
            )
            .limit(1);
          return row ? mapAttachment(row) : null;
        }),
      save: (entity) =>
        safe(async () => {
          const [row] = await db
            .insert(schema.attachments)
            .values(entity)
            .onConflictDoUpdate({
              target: schema.attachments.id,
              set: {
                messageId: entity.messageId ?? null,
                detectedMimeType: entity.detectedMimeType ?? null,
                checksumSha256: entity.checksumSha256 ?? null,
                status: entity.status,
                scanStatus: entity.scanStatus,
                rejectionReasonCode: entity.rejectionReasonCode ?? null,
                uploadedAt: entity.uploadedAt ?? null,
                uploadExpiresAt: entity.uploadExpiresAt ?? null,
                scannedAt: entity.scannedAt ?? null,
                attachedAt: entity.attachedAt ?? null,
                deletedAt: entity.deletedAt ?? null,
                updatedAt: entity.updatedAt,
              },
              setWhere: eq(schema.attachments.projectId, entity.projectId),
            })
            .returning();
          if (!row)
            throw new DomainError("NOT_FOUND", "Attachment was not found.");
          return mapAttachment(row);
        }),
      findByMessage: (projectId, messageId) =>
        safe(async () =>
          db
            .select()
            .from(schema.attachments)
            .where(
              and(
                eq(schema.attachments.projectId, projectId),
                eq(schema.attachments.messageId, messageId),
              ),
            )
            .then((rows) => rows.map(mapAttachment)),
        ),
      claimForMessage: (input) =>
        safe(async () => {
          const [row] = await db
            .update(schema.attachments)
            .set({
              messageId: input.messageId,
              attachedAt: input.attachedAt,
              updatedAt: input.attachedAt,
            })
            .where(
              and(
                eq(schema.attachments.projectId, input.projectId),
                eq(schema.attachments.id, input.attachmentId),
                eq(schema.attachments.conversationId, input.conversationId),
                eq(schema.attachments.uploaderId, input.uploaderId),
                eq(schema.attachments.visibility, input.visibility),
                eq(schema.attachments.status, "ready"),
                isNull(schema.attachments.messageId),
              ),
            )
            .returning();
          return row ? mapAttachment(row) : null;
        }),
    },
    tags: {
      findById: ({ projectId, id }) =>
        safe(async () => {
          const [row] = await db
            .select()
            .from(schema.tags)
            .where(
              and(eq(schema.tags.projectId, projectId), eq(schema.tags.id, id)),
            )
            .limit(1);
          return row ? mapTag(row) : null;
        }),
      save: (entity) =>
        safe(async () => {
          const [row] = await db
            .insert(schema.tags)
            .values(entity)
            .onConflictDoUpdate({
              target: [schema.tags.projectId, schema.tags.name],
              set: { color: entity.color ?? null, updatedAt: entity.updatedAt },
            })
            .returning();
          if (!row) return missingResult();
          return mapTag(row);
        }),
    },
    conversationTags: {
      add: (projectId, conversationId, tagId) =>
        safe(async () => {
          await db
            .insert(schema.conversationTags)
            .values({
              projectId,
              conversationId,
              tagId,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .onConflictDoNothing();
        }),
      remove: (projectId, conversationId, tagId) =>
        safe(async () => {
          await db
            .delete(schema.conversationTags)
            .where(
              and(
                eq(schema.conversationTags.projectId, projectId),
                eq(schema.conversationTags.conversationId, conversationId),
                eq(schema.conversationTags.tagId, tagId),
              ),
            );
        }),
    },
    savedReplies: {
      findById: ({ projectId, id }) =>
        safe(async () => {
          const [row] = await db
            .select()
            .from(schema.savedReplies)
            .where(
              and(
                eq(schema.savedReplies.projectId, projectId),
                eq(schema.savedReplies.id, id),
              ),
            )
            .limit(1);
          return row ? mapSavedReply(row) : null;
        }),
      save: (entity) =>
        safe(async () => {
          const [row] = await db
            .insert(schema.savedReplies)
            .values(entity)
            .onConflictDoUpdate({
              target: schema.savedReplies.id,
              set: {
                title: entity.title,
                body: entity.body,
                updatedAt: entity.updatedAt,
              },
              setWhere: eq(schema.savedReplies.projectId, entity.projectId),
            })
            .returning();
          if (!row)
            throw new DomainError("NOT_FOUND", "Saved reply was not found.");
          return mapSavedReply(row);
        }),
    },
    audit: {
      append: (event: AuditEvent) =>
        safe(async () => {
          await db.insert(schema.auditLogs).values(event);
        }),
    },
    knowledge: {
      findArticle: ({ projectId, id }) =>
        safe(async () => {
          const [row] = await db
            .select()
            .from(schema.knowledgeArticles)
            .where(
              and(
                eq(schema.knowledgeArticles.projectId, projectId),
                eq(schema.knowledgeArticles.id, id),
              ),
            )
            .limit(1);
          return row ? mapKnowledgeArticle(row) : null;
        }),
      findArticleBySourceKey: (projectId, sourceKey) =>
        safe(async () => {
          const [row] = await db
            .select()
            .from(schema.knowledgeArticles)
            .where(
              and(
                eq(schema.knowledgeArticles.projectId, projectId),
                eq(schema.knowledgeArticles.sourceKey, sourceKey),
              ),
            )
            .limit(1);
          return row ? mapKnowledgeArticle(row) : null;
        }),
      listArticles: (projectId, status) =>
        safe(async () =>
          (
            await db
              .select()
              .from(schema.knowledgeArticles)
              .where(
                and(
                  eq(schema.knowledgeArticles.projectId, projectId),
                  ...(status
                    ? [eq(schema.knowledgeArticles.status, status)]
                    : []),
                ),
              )
              .orderBy(desc(schema.knowledgeArticles.updatedAt))
          ).map(mapKnowledgeArticle),
        ),
      saveArticle: (entity) =>
        safe(async () => {
          const [row] = await db
            .insert(schema.knowledgeArticles)
            .values({
              ...entity,
              activeRevisionNumber: entity.activeRevisionNumber ?? null,
              publishedAt: entity.publishedAt ?? null,
              archivedAt: entity.archivedAt ?? null,
            })
            .onConflictDoUpdate({
              target: schema.knowledgeArticles.id,
              set: {
                title: entity.title,
                summary: entity.summary,
                body: entity.body,
                status: entity.status,
                revisionNumber: entity.revisionNumber,
                activeRevisionNumber: entity.activeRevisionNumber ?? null,
                tags: entity.tags,
                updatedByAgentId: entity.updatedByAgentId,
                publishedAt: entity.publishedAt ?? null,
                archivedAt: entity.archivedAt ?? null,
                updatedAt: entity.updatedAt,
              },
              setWhere: eq(
                schema.knowledgeArticles.projectId,
                entity.projectId,
              ),
            })
            .returning();
          if (!row) return missingResult();
          return mapKnowledgeArticle(row);
        }),
      saveRevision: (entity) =>
        safe(async () => {
          const [row] = await db
            .insert(schema.knowledgeRevisions)
            .values(entity)
            .returning();
          if (!row) return missingResult();
          return mapKnowledgeRevision(row);
        }),
      listRevisions: (projectId, articleId) =>
        safe(async () =>
          (
            await db
              .select()
              .from(schema.knowledgeRevisions)
              .where(
                and(
                  eq(schema.knowledgeRevisions.projectId, projectId),
                  eq(schema.knowledgeRevisions.articleId, articleId),
                ),
              )
              .orderBy(desc(schema.knowledgeRevisions.revisionNumber))
          ).map(mapKnowledgeRevision),
        ),
      replaceChunks: (projectId, articleId, revisionNumber, chunks) =>
        safe(async () => {
          await db
            .delete(schema.knowledgeChunks)
            .where(
              and(
                eq(schema.knowledgeChunks.projectId, projectId),
                eq(schema.knowledgeChunks.articleId, articleId),
                eq(schema.knowledgeChunks.revisionNumber, revisionNumber),
              ),
            );
          if (chunks.length)
            await db.insert(schema.knowledgeChunks).values(
              chunks.map((chunk) => ({
                ...chunk,
                section: chunk.section ?? null,
                searchText: `${chunk.title} ${chunk.content}`,
              })),
            );
        }),
      searchPublished: (projectId, query, limit) =>
        safe(async () =>
          (
            await db
              .select({ chunk: schema.knowledgeChunks })
              .from(schema.knowledgeChunks)
              .innerJoin(
                schema.knowledgeArticles,
                and(
                  eq(
                    schema.knowledgeArticles.projectId,
                    schema.knowledgeChunks.projectId,
                  ),
                  eq(
                    schema.knowledgeArticles.id,
                    schema.knowledgeChunks.articleId,
                  ),
                  eq(
                    schema.knowledgeArticles.activeRevisionNumber,
                    schema.knowledgeChunks.revisionNumber,
                  ),
                ),
              )
              .where(
                and(
                  eq(schema.knowledgeChunks.projectId, projectId),
                  eq(schema.knowledgeArticles.status, "published"),
                  sql`to_tsvector('simple', ${schema.knowledgeChunks.searchText}) @@ plainto_tsquery('simple', ${query})`,
                ),
              )
              .orderBy(
                desc(
                  sql`ts_rank(to_tsvector('simple', ${schema.knowledgeChunks.searchText}), plainto_tsquery('simple', ${query}))`,
                ),
                asc(schema.knowledgeChunks.chunkIndex),
              )
              .limit(limit)
          ).map(({ chunk }) => mapKnowledgeChunk(chunk)),
        ),
    },
    chatbot: {
      findSession: ({ projectId, id }) =>
        safe(async () => {
          const [row] = await db
            .select()
            .from(schema.chatbotSessions)
            .where(
              and(
                eq(schema.chatbotSessions.projectId, projectId),
                eq(schema.chatbotSessions.id, id),
              ),
            )
            .limit(1);
          return row ? mapChatbotSession(row) : null;
        }),
      saveSession: (entity) =>
        safe(async () => {
          const [row] = await db
            .insert(schema.chatbotSessions)
            .values({
              ...entity,
              conversationId: entity.conversationId ?? null,
              handedOffAt: entity.handedOffAt ?? null,
            })
            .onConflictDoUpdate({
              target: schema.chatbotSessions.id,
              set: {
                status: entity.status,
                conversationId: entity.conversationId ?? null,
                turnCount: entity.turnCount,
                handedOffAt: entity.handedOffAt ?? null,
                updatedAt: entity.updatedAt,
              },
              setWhere: eq(schema.chatbotSessions.projectId, entity.projectId),
            })
            .returning();
          if (!row) return missingResult();
          return mapChatbotSession(row);
        }),
      listTurns: (projectId, sessionId) =>
        safe(async () =>
          (
            await db
              .select()
              .from(schema.chatbotTurns)
              .where(
                and(
                  eq(schema.chatbotTurns.projectId, projectId),
                  eq(schema.chatbotTurns.sessionId, sessionId),
                ),
              )
              .orderBy(
                asc(schema.chatbotTurns.createdAt),
                asc(schema.chatbotTurns.id),
              )
          ).map(mapChatbotTurn),
        ),
      findTurnByClientMessageId: (projectId, sessionId, clientMessageId) =>
        safe(async () => {
          const [row] = await db
            .select()
            .from(schema.chatbotTurns)
            .where(
              and(
                eq(schema.chatbotTurns.projectId, projectId),
                eq(schema.chatbotTurns.sessionId, sessionId),
                eq(schema.chatbotTurns.clientMessageId, clientMessageId),
              ),
            )
            .limit(1);
          return row ? mapChatbotTurn(row) : null;
        }),
      saveTurn: (entity) =>
        safe(async () => {
          const [row] = await db
            .insert(schema.chatbotTurns)
            .values({
              ...entity,
              clientMessageId: entity.clientMessageId ?? null,
              modelReference: entity.modelReference ?? null,
            })
            .onConflictDoNothing()
            .returning();
          if (row) return mapChatbotTurn(row);
          const [existing] = await db
            .select()
            .from(schema.chatbotTurns)
            .where(
              and(
                eq(schema.chatbotTurns.projectId, entity.projectId),
                eq(schema.chatbotTurns.id, entity.id),
              ),
            )
            .limit(1);
          if (!existing) return missingResult();
          return mapChatbotTurn(existing);
        }),
      findHandoff: (projectId, sessionId) =>
        safe(async () => {
          const [row] = await db
            .select()
            .from(schema.chatbotHandoffs)
            .where(
              and(
                eq(schema.chatbotHandoffs.projectId, projectId),
                eq(schema.chatbotHandoffs.sessionId, sessionId),
              ),
            )
            .limit(1);
          return row ? mapChatbotHandoff(row) : null;
        }),
      saveHandoff: (entity) =>
        safe(async () => {
          const [row] = await db
            .insert(schema.chatbotHandoffs)
            .values(entity)
            .onConflictDoNothing()
            .returning();
          if (row) return mapChatbotHandoff(row);
          const [existing] = await db
            .select()
            .from(schema.chatbotHandoffs)
            .where(
              and(
                eq(schema.chatbotHandoffs.projectId, entity.projectId),
                eq(schema.chatbotHandoffs.sessionId, entity.sessionId),
              ),
            )
            .limit(1);
          if (!existing) return missingResult();
          return mapChatbotHandoff(existing);
        }),
    },
    transaction: (operation) =>
      safe(() =>
        db.transaction(async (transaction) =>
          operation(createAdapter(transaction as Database)),
        ),
      ),
  };
  return adapter;
}

/** Creates a project-scoped Drizzle/PostgreSQL support database adapter. */
export function createDrizzleSupportDatabase(
  options: DrizzleSupportDatabaseOptions,
): SupportDatabaseAdapter {
  const client =
    "client" in options
      ? options.client
      : postgres(options.connectionString, {
          max: options.maxConnections ?? 10,
        });
  const database = drizzle(client, { schema });
  const adapter = createAdapter(database);
  return Object.assign(adapter, {
    healthCheck: () =>
      safe(async () => {
        await database.execute(sql`select 1`);
      }),
    ...("client" in options
      ? {}
      : {
          dispose: () =>
            safe(async () => {
              await client.end();
            }),
        }),
  });
}
