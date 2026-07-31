import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import postgres, { type Sql } from "postgres";
import {
  DomainError,
  type SupportDatabaseAdapter,
} from "@crazyglegit/support-core";
import { createDrizzleSupportDatabase } from "./database.js";
import { runSupportMigrations } from "./migrate.js";

const now = new Date("2026-08-01T00:00:00.000Z");
let container: StartedPostgreSqlContainer | undefined;
let client: Sql | undefined;
let database: SupportDatabaseAdapter;

async function project(key: string): Promise<string> {
  const id = randomUUID();
  await database.projects.create({
    id,
    projectKey: key,
    name: key,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

function activeClient(): Sql {
  if (!client) throw new Error("PostgreSQL test client is not initialized.");
  return client;
}

describe.sequential("PostgreSQL Drizzle adapter", () => {
  beforeAll(async () => {
    const configuredUrl = process.env.SUPPORT_TEST_DATABASE_URL;
    if (configuredUrl) {
      client = postgres(configuredUrl, { max: 5 });
    } else {
      container = await new PostgreSqlContainer("postgres:16-alpine").start();
      client = postgres(container.getConnectionUri(), { max: 5 });
    }
    await runSupportMigrations({
      client,
      migrationsFolder: new URL("../drizzle", import.meta.url).pathname,
    });
    database = createDrizzleSupportDatabase({ client });
  }, 120_000);

  afterAll(async () => {
    await client?.end();
    await container?.stop();
  });

  it("migrates all Phase 4 tables from an empty database", async () => {
    const rows = await activeClient()<
      { table_name: string }[]
    >`select table_name from information_schema.tables where table_schema = 'public' and table_name like 'support_%' order by table_name`;
    expect(rows.map((row) => row.table_name)).toEqual(
      expect.arrayContaining([
        "support_projects",
        "support_customers",
        "support_customer_sessions",
        "support_agents",
        "support_conversations",
        "support_conversation_participants",
        "support_conversation_assignments",
        "support_messages",
        "support_message_receipts",
        "support_attachments",
        "support_tags",
        "support_conversation_tags",
        "support_saved_replies",
        "support_audit_logs",
      ]),
    );
  });

  it("resolves project keys once and isolates customer records by UUID projectId", async () => {
    const first = await project("first-installation");
    const second = await project("second-installation");
    expect((await database.projects.findByKey("first-installation"))?.id).toBe(
      first,
    );
    const customerId = randomUUID();
    await database.customers.save({
      id: customerId,
      projectId: first,
      externalCustomerId: "host-user",
      metadata: {},
      createdAt: now,
      updatedAt: now,
    });
    await database.customers.save({
      id: randomUUID(),
      projectId: second,
      externalCustomerId: "host-user",
      metadata: {},
      createdAt: now,
      updatedAt: now,
    });
    expect(
      await database.customers.findById({ projectId: second, id: customerId }),
    ).toBeNull();
    await expect(
      database.customers.save({
        id: randomUUID(),
        projectId: first,
        externalCustomerId: "host-user",
        metadata: {},
        createdAt: now,
        updatedAt: now,
      }),
    ).resolves.toMatchObject({ id: customerId });
  });

  it("persists conversations, participants, inbox assignments, messages, notes, and receipts idempotently", async () => {
    const projectId = await project("workflow");
    const customerId = randomUUID();
    const agentId = randomUUID();
    const conversationId = randomUUID();
    await database.customers.save({
      id: customerId,
      projectId,
      externalCustomerId: "customer",
      metadata: {},
      createdAt: now,
      updatedAt: now,
    });
    await database.agents.save({
      id: agentId,
      projectId,
      externalAgentId: "agent",
      name: "Agent",
      role: "support_agent",
      permissions: ["conversation.read"],
      createdAt: now,
      updatedAt: now,
    });
    await database.transaction(async (tx) => {
      await tx.conversations.save({
        id: conversationId,
        projectId,
        status: "open",
        createdAt: now,
        updatedAt: now,
      });
      await tx.participants.save({
        id: randomUUID(),
        projectId,
        conversationId,
        participantId: customerId,
        participantType: "customer",
        createdAt: now,
        updatedAt: now,
      });
      await tx.messages.save({
        id: randomUUID(),
        projectId,
        conversationId,
        clientMessageId: "client-message-0001",
        type: "text",
        senderType: "customer",
        senderId: customerId,
        body: "Hello",
        deliveryStatus: "sent",
        createdAt: now,
        updatedAt: now,
      });
    });
    expect(
      await database.conversations.listByParticipant(
        projectId,
        "customer",
        customerId,
      ),
    ).toHaveLength(1);
    const assignment = await database.assignments.save({
      id: randomUUID(),
      projectId,
      conversationId,
      agentId,
      createdAt: now,
      updatedAt: now,
    });
    expect(
      await database.conversations.listInbox(projectId, agentId),
    ).toHaveLength(1);
    await database.assignments.save({
      ...assignment,
      unassignedAt: new Date(now.getTime() + 1),
      updatedAt: new Date(now.getTime() + 1),
    });
    const note = await database.messages.save({
      id: randomUUID(),
      projectId,
      conversationId,
      clientMessageId: "client-note-000001",
      type: "internal_note",
      senderType: "agent",
      senderId: agentId,
      body: "Private",
      deliveryStatus: "sent",
      createdAt: now,
      updatedAt: now,
    });
    expect(
      (await database.messages.findById({ projectId, id: note.id }))?.type,
    ).toBe("internal_note");
    const receipt = {
      id: randomUUID(),
      projectId,
      conversationId,
      messageId: note.id,
      readerType: "agent" as const,
      readerId: agentId,
      readAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const first = await database.messageReceipts.create(receipt);
    const duplicate = await database.messageReceipts.create({
      ...receipt,
      id: randomUUID(),
    });
    expect(duplicate.id).toBe(first.id);
    const secondReader = await database.messageReceipts.create({
      ...receipt,
      id: randomUUID(),
      readerId: customerId,
    });
    expect(secondReader.id).not.toBe(first.id);
  });

  it("supports tag mutation, attachment boundaries, enum constraints, and sanitized errors", async () => {
    const projectId = await project("constraints");
    const otherProjectId = await project("constraints-other");
    const conversationId = randomUUID();
    await database.conversations.save({
      id: conversationId,
      projectId,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });
    const tag = await database.tags.save({
      id: randomUUID(),
      projectId,
      name: "vip",
      createdAt: now,
      updatedAt: now,
    });
    await database.conversationTags.add(projectId, conversationId, tag.id);
    await database.conversationTags.add(projectId, conversationId, tag.id);
    await database.conversationTags.remove(projectId, conversationId, tag.id);
    const attachment = await database.attachments.save({
      id: randomUUID(),
      projectId,
      fileName: "file.txt",
      mediaType: "text/plain",
      sizeBytes: 4,
      createdAt: now,
      updatedAt: now,
    });
    expect(
      await database.attachments.findById({
        projectId: otherProjectId,
        id: attachment.id,
      }),
    ).toBeNull();
    await expect(
      database.conversations.save({
        id: randomUUID(),
        projectId,
        status: "invalid" as "open",
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      database.conversations.findById({
        projectId: "not-a-uuid",
        id: conversationId,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<DomainError>>({
        code: "VALIDATION_ERROR",
        message: "The support record is invalid.",
      }),
    );
  });

  it("rolls back all writes when a transaction fails", async () => {
    const projectId = await project("rollback");
    const conversationId = randomUUID();
    await expect(
      database.transaction(async (tx) => {
        await tx.conversations.save({
          id: conversationId,
          projectId,
          status: "open",
          createdAt: now,
          updatedAt: now,
        });
        throw new Error("secret database detail");
      }),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      message: "The database operation failed.",
    });
    expect(
      await database.conversations.findById({ projectId, id: conversationId }),
    ).toBeNull();
  });

  it("keeps audit rows immutable and enforces project-scoped associations", async () => {
    const projectId = await project("immutable-audit");
    const otherProjectId = await project("association-boundary");
    const conversationId = randomUUID();
    await database.conversations.save({
      id: conversationId,
      projectId,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });
    const auditId = randomUUID();
    await database.audit.append({
      id: auditId,
      projectId,
      action: "test.created",
      actorType: "system",
      resourceType: "test",
      metadata: {},
      createdAt: now,
      updatedAt: now,
    });
    await expect(
      activeClient()`update support_audit_logs set action = 'changed' where id = ${auditId}`,
    ).rejects.toMatchObject({ code: "23000" });
    const otherTag = await database.tags.save({
      id: randomUUID(),
      projectId: otherProjectId,
      name: "other",
      createdAt: now,
      updatedAt: now,
    });
    await expect(
      database.conversationTags.add(projectId, conversationId, otherTag.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
