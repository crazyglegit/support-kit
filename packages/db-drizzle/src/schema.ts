import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const conversationStatusEnum = pgEnum("support_conversation_status", [
  "open",
  "waiting_for_agent",
  "waiting_for_customer",
  "resolved",
  "closed",
  "spam",
]);
export const messageTypeEnum = pgEnum("support_message_type", [
  "text",
  "image",
  "file",
  "bot",
  "system",
  "internal_note",
  "quick_reply",
]);
export const senderTypeEnum = pgEnum("support_sender_type", [
  "customer",
  "visitor",
  "agent",
  "bot",
  "system",
]);
export const deliveryStatusEnum = pgEnum("support_delivery_status", [
  "pending",
  "sent",
  "delivered",
  "read",
  "failed",
]);
export const participantTypeEnum = pgEnum("support_participant_type", [
  "customer",
  "visitor",
  "agent",
]);
export const attachmentStatusEnum = pgEnum("support_attachment_status", [
  "pending_upload",
  "uploaded",
  "scanning",
  "ready",
  "rejected",
  "failed",
  "deleted",
]);
export const attachmentScanStatusEnum = pgEnum(
  "support_attachment_scan_status",
  ["pending", "clean", "infected", "suspicious", "failed", "skipped"],
);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
};

export const projects = pgTable(
  "support_projects",
  {
    id: uuid("id").primaryKey(),
    projectKey: text("project_key").notNull(),
    name: text("name").notNull(),
    metadata: jsonb("metadata")
      .$type<Readonly<Record<string, unknown>>>()
      .notNull()
      .default({}),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("support_projects_project_key_uidx").on(table.projectKey),
  ],
);

const projectId = () =>
  uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" });

export const customers = pgTable(
  "support_customers",
  {
    id: uuid("id").primaryKey(),
    projectId: projectId(),
    externalCustomerId: text("external_customer_id").notNull(),
    name: text("name"),
    email: text("email"),
    metadata: jsonb("metadata")
      .$type<Readonly<Record<string, unknown>>>()
      .notNull()
      .default({}),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("support_customers_project_external_uidx").on(
      t.projectId,
      t.externalCustomerId,
    ),
    unique("support_customers_project_id_unique").on(t.projectId, t.id),
  ],
);

export const visitors = pgTable(
  "support_visitors",
  {
    id: uuid("id").primaryKey(),
    projectId: projectId(),
    externalVisitorId: text("external_visitor_id").notNull(),
    sessionId: text("session_id"),
    name: text("name"),
    email: text("email"),
    metadata: jsonb("metadata")
      .$type<Readonly<Record<string, unknown>>>()
      .notNull()
      .default({}),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("support_visitors_project_external_uidx").on(
      t.projectId,
      t.externalVisitorId,
    ),
    unique("support_visitors_project_id_unique").on(t.projectId, t.id),
    index("support_visitors_project_session_idx").on(t.projectId, t.sessionId),
  ],
);

export const customerSessions = pgTable(
  "support_customer_sessions",
  {
    id: uuid("id").primaryKey(),
    projectId: projectId(),
    customerId: uuid("customer_id"),
    visitorId: uuid("visitor_id"),
    sessionHash: text("session_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    metadata: jsonb("metadata")
      .$type<Readonly<Record<string, unknown>>>()
      .notNull()
      .default({}),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "support_customer_sessions_project_customer_fk",
      columns: [t.projectId, t.customerId],
      foreignColumns: [customers.projectId, customers.id],
    }),
    uniqueIndex("support_customer_sessions_project_hash_uidx").on(
      t.projectId,
      t.sessionHash,
    ),
    index("support_customer_sessions_project_customer_idx").on(
      t.projectId,
      t.customerId,
    ),
  ],
);

export const agents = pgTable(
  "support_agents",
  {
    id: uuid("id").primaryKey(),
    projectId: projectId(),
    externalAgentId: text("external_agent_id").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    role: text("role").notNull(),
    permissions: jsonb("permissions")
      .$type<readonly string[]>()
      .notNull()
      .default([]),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("support_agents_project_external_uidx").on(
      t.projectId,
      t.externalAgentId,
    ),
    unique("support_agents_project_id_unique").on(t.projectId, t.id),
  ],
);

export const conversations = pgTable(
  "support_conversations",
  {
    id: uuid("id").primaryKey(),
    projectId: projectId(),
    status: conversationStatusEnum("status").notNull(),
    subject: text("subject"),
    priority: text("priority"),
    ...timestamps,
  },
  (t) => [
    unique("support_conversations_project_id_unique").on(t.projectId, t.id),
    index("support_conversations_project_status_updated_idx").on(
      t.projectId,
      t.status,
      t.updatedAt,
    ),
  ],
);

export const conversationParticipants = pgTable(
  "support_conversation_participants",
  {
    id: uuid("id").primaryKey(),
    projectId: projectId(),
    conversationId: uuid("conversation_id").notNull(),
    participantId: uuid("participant_id").notNull(),
    participantType: participantTypeEnum("participant_type").notNull(),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "support_participants_project_conversation_fk",
      columns: [t.projectId, t.conversationId],
      foreignColumns: [conversations.projectId, conversations.id],
    }).onDelete("cascade"),
    uniqueIndex("support_participants_project_conversation_actor_uidx").on(
      t.projectId,
      t.conversationId,
      t.participantType,
      t.participantId,
    ),
    index("support_participants_project_actor_idx").on(
      t.projectId,
      t.participantType,
      t.participantId,
    ),
  ],
);

export const conversationAssignments = pgTable(
  "support_conversation_assignments",
  {
    id: uuid("id").primaryKey(),
    projectId: projectId(),
    conversationId: uuid("conversation_id").notNull(),
    agentId: uuid("agent_id").notNull(),
    assignedByAgentId: uuid("assigned_by_agent_id"),
    unassignedAt: timestamp("unassigned_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "support_assignments_project_conversation_fk",
      columns: [t.projectId, t.conversationId],
      foreignColumns: [conversations.projectId, conversations.id],
    }),
    foreignKey({
      name: "support_assignments_project_agent_fk",
      columns: [t.projectId, t.agentId],
      foreignColumns: [agents.projectId, agents.id],
    }),
    foreignKey({
      name: "support_assignments_project_assigner_fk",
      columns: [t.projectId, t.assignedByAgentId],
      foreignColumns: [agents.projectId, agents.id],
    }),
    index("support_assignments_project_conversation_idx").on(
      t.projectId,
      t.conversationId,
      t.createdAt,
    ),
    uniqueIndex("support_assignments_one_active_uidx")
      .on(t.projectId, t.conversationId)
      .where(sql`${t.unassignedAt} is null`),
    index("support_assignments_project_agent_idx").on(t.projectId, t.agentId),
  ],
);

export const messages = pgTable(
  "support_messages",
  {
    id: uuid("id").primaryKey(),
    projectId: projectId(),
    conversationId: uuid("conversation_id").notNull(),
    clientMessageId: text("client_message_id"),
    type: messageTypeEnum("type").notNull(),
    senderType: senderTypeEnum("sender_type").notNull(),
    senderId: uuid("sender_id"),
    body: text("body").notNull(),
    deliveryStatus: deliveryStatusEnum("delivery_status").notNull(),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "support_messages_project_conversation_fk",
      columns: [t.projectId, t.conversationId],
      foreignColumns: [conversations.projectId, conversations.id],
    }).onDelete("cascade"),
    uniqueIndex("support_messages_project_conversation_client_uidx")
      .on(t.projectId, t.conversationId, t.clientMessageId)
      .where(sql`${t.clientMessageId} is not null`),
    unique("support_messages_project_id_unique").on(t.projectId, t.id),
    index("support_messages_project_conversation_cursor_idx").on(
      t.projectId,
      t.conversationId,
      t.createdAt,
      t.id,
    ),
  ],
);

export const messageReceipts = pgTable(
  "support_message_receipts",
  {
    id: uuid("id").primaryKey(),
    projectId: projectId(),
    messageId: uuid("message_id").notNull(),
    conversationId: uuid("conversation_id").notNull(),
    readerType: participantTypeEnum("reader_type").notNull(),
    readerId: uuid("reader_id").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "support_receipts_project_message_fk",
      columns: [t.projectId, t.messageId],
      foreignColumns: [messages.projectId, messages.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "support_receipts_project_conversation_fk",
      columns: [t.projectId, t.conversationId],
      foreignColumns: [conversations.projectId, conversations.id],
    }).onDelete("cascade"),
    uniqueIndex("support_receipts_project_message_reader_uidx").on(
      t.projectId,
      t.messageId,
      t.readerType,
      t.readerId,
    ),
    index("support_receipts_project_conversation_idx").on(
      t.projectId,
      t.conversationId,
    ),
  ],
);

export const attachments = pgTable(
  "support_attachments",
  {
    id: uuid("id").primaryKey(),
    projectId: projectId(),
    conversationId: uuid("conversation_id").notNull(),
    messageId: uuid("message_id"),
    uploaderType: senderTypeEnum("uploader_type").notNull(),
    uploaderId: uuid("uploader_id").notNull(),
    visibility: text("visibility")
      .$type<"public" | "internal_note">()
      .notNull(),
    storageKey: text("storage_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    safeDisplayFilename: text("safe_display_filename").notNull(),
    claimedMimeType: text("claimed_mime_type").notNull(),
    detectedMimeType: text("detected_mime_type"),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    checksumSha256: text("checksum_sha256"),
    status: attachmentStatusEnum("status").notNull(),
    scanStatus: attachmentScanStatusEnum("scan_status").notNull(),
    rejectionReasonCode: text("rejection_reason_code"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
    uploadExpiresAt: timestamp("upload_expires_at", { withTimezone: true }),
    scannedAt: timestamp("scanned_at", { withTimezone: true }),
    attachedAt: timestamp("attached_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    metadata: jsonb("metadata")
      .$type<Readonly<Record<string, unknown>>>()
      .notNull()
      .default({}),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "support_attachments_project_conversation_fk",
      columns: [t.projectId, t.conversationId],
      foreignColumns: [conversations.projectId, conversations.id],
    }),
    foreignKey({
      name: "support_attachments_project_message_fk",
      columns: [t.projectId, t.messageId],
      foreignColumns: [messages.projectId, messages.id],
    }),
    uniqueIndex("support_attachments_project_id_uidx").on(t.projectId, t.id),
    uniqueIndex("support_attachments_storage_key_uidx").on(t.storageKey),
    index("support_attachments_project_conversation_idx").on(
      t.projectId,
      t.conversationId,
    ),
    index("support_attachments_project_message_idx").on(
      t.projectId,
      t.messageId,
    ),
    index("support_attachments_project_uploader_idx").on(
      t.projectId,
      t.uploaderType,
      t.uploaderId,
    ),
    index("support_attachments_project_status_idx").on(t.projectId, t.status),
    check(
      "support_attachments_visibility_check",
      sql`${t.visibility} in ('public', 'internal_note')`,
    ),
  ],
);

export const tags = pgTable(
  "support_tags",
  {
    id: uuid("id").primaryKey(),
    projectId: projectId(),
    name: text("name").notNull(),
    color: text("color"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("support_tags_project_name_uidx").on(t.projectId, t.name),
    unique("support_tags_project_id_unique").on(t.projectId, t.id),
  ],
);

export const conversationTags = pgTable(
  "support_conversation_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: projectId(),
    conversationId: uuid("conversation_id").notNull(),
    tagId: uuid("tag_id").notNull(),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "support_conversation_tags_project_conversation_fk",
      columns: [t.projectId, t.conversationId],
      foreignColumns: [conversations.projectId, conversations.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "support_conversation_tags_project_tag_fk",
      columns: [t.projectId, t.tagId],
      foreignColumns: [tags.projectId, tags.id],
    }).onDelete("cascade"),
    uniqueIndex("support_conversation_tags_project_pair_uidx").on(
      t.projectId,
      t.conversationId,
      t.tagId,
    ),
    index("support_conversation_tags_project_tag_idx").on(t.projectId, t.tagId),
  ],
);

export const savedReplies = pgTable(
  "support_saved_replies",
  {
    id: uuid("id").primaryKey(),
    projectId: projectId(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdByAgentId: uuid("created_by_agent_id").notNull(),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "support_saved_replies_project_agent_fk",
      columns: [t.projectId, t.createdByAgentId],
      foreignColumns: [agents.projectId, agents.id],
    }),
    uniqueIndex("support_saved_replies_project_id_uidx").on(t.projectId, t.id),
    index("support_saved_replies_project_title_idx").on(t.projectId, t.title),
  ],
);

export const auditLogs = pgTable(
  "support_audit_logs",
  {
    id: uuid("id").primaryKey(),
    projectId: projectId(),
    action: text("action").notNull(),
    actorId: uuid("actor_id"),
    actorType: senderTypeEnum("actor_type").notNull(),
    resourceId: uuid("resource_id"),
    resourceType: text("resource_type").notNull(),
    metadata: jsonb("metadata")
      .$type<Readonly<Record<string, unknown>>>()
      .notNull()
      .default({}),
    ...timestamps,
  },
  (t) => [
    index("support_audit_project_cursor_idx").on(
      t.projectId,
      t.createdAt,
      t.id,
    ),
    index("support_audit_project_resource_idx").on(
      t.projectId,
      t.resourceType,
      t.resourceId,
    ),
  ],
);
