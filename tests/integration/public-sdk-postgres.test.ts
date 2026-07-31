import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import {
  createSupportKit,
  type AgentIdentity,
  type CustomerIdentity,
  type SupportAuthAdapter,
  type SupportAuthContext,
  type VisitorIdentity,
} from "@crazyglegit/support";
import {
  createDrizzleSupportDatabase,
  runSupportMigrations,
} from "@crazyglegit/support-db-drizzle";
import postgres, { type Sql } from "postgres";

const migrationsFolder = fileURLToPath(
  new URL("../../packages/db-drizzle/drizzle", import.meta.url),
);
const authContext: SupportAuthContext = {
  method: "GET",
  url: "https://support.example.test/session",
  headers: {},
};
const agentPermissions = [
  "conversation.read",
  "conversation.reply",
  "conversation.assign",
  "conversation.close",
  "conversation.reopen",
  "conversation.mark_spam",
  "internal_note.create",
  "internal_note.read",
] as const;

interface ProjectIdentities {
  readonly customer: CustomerIdentity;
  readonly visitor: VisitorIdentity;
  readonly agent: AgentIdentity;
  readonly limitedAgent: AgentIdentity;
}

function authAdapter(identities: ProjectIdentities): SupportAuthAdapter {
  return {
    getCustomer: () => Promise.resolve(identities.customer),
    getVisitor: () => Promise.resolve(identities.visitor),
    getAgent: (context) =>
      Promise.resolve(
        context.headers["x-test-agent"] === "limited"
          ? identities.limitedAgent
          : identities.agent,
      ),
  };
}

async function expectCode(
  operation: Promise<unknown>,
  code: string,
): Promise<void> {
  await expect(operation).rejects.toMatchObject({ code });
}

let container: StartedPostgreSqlContainer | undefined;
let client: Sql | undefined;

function activeClient(): Sql {
  if (!client) throw new Error("PostgreSQL test client is not initialized.");
  return client;
}

describe.sequential("public SDK with PostgreSQL", () => {
  beforeAll(async () => {
    const configuredUrl = process.env.SUPPORT_TEST_DATABASE_URL;
    if (configuredUrl) {
      client = postgres(configuredUrl, { max: 5 });
    } else {
      container = await new PostgreSqlContainer("postgres:16-alpine").start();
      client = postgres(container.getConnectionUri(), { max: 5 });
    }

    await runSupportMigrations({ client: activeClient(), migrationsFolder });
  });

  afterAll(async () => {
    await client?.end();
    await container?.stop();
  });

  it("executes the complete Phase 5 workflow through the public SDK", async () => {
    const database = createDrizzleSupportDatabase({ client: activeClient() });
    const runId = randomUUID();
    const identitiesA: ProjectIdentities = {
      customer: { id: "customer-a", name: "Customer A" },
      visitor: { id: "visitor-a", sessionId: "visitor-session-a" },
      agent: {
        id: "agent-a",
        name: "Agent A",
        role: "support_agent",
        permissions: agentPermissions,
      },
      limitedAgent: {
        id: "limited-agent-a",
        name: "Limited Agent A",
        role: "support_viewer",
        permissions: ["conversation.read"],
      },
    };
    const identitiesB: ProjectIdentities = {
      customer: { id: "customer-b", name: "Customer B" },
      visitor: { id: "visitor-b", sessionId: "visitor-session-b" },
      agent: {
        id: "agent-b",
        name: "Agent B",
        role: "support_agent",
        permissions: agentPermissions,
      },
      limitedAgent: {
        id: "limited-agent-b",
        name: "Limited Agent B",
        role: "support_viewer",
        permissions: ["conversation.read"],
      },
    };
    const supportA = await createSupportKit({
      projectKey: `phase-5-checkpoint-a-${runId}`,
      projectInitialization: {
        mode: "create-if-missing",
        name: "Phase 5 checkpoint A",
      },
      database,
      auth: authAdapter(identitiesA),
      security: { allowedOrigins: ["https://support.example.test"] },
    });
    const supportB = await createSupportKit({
      projectKey: `phase-5-checkpoint-b-${runId}`,
      projectInitialization: {
        mode: "create-if-missing",
        name: "Phase 5 checkpoint B",
      },
      database,
      auth: authAdapter(identitiesB),
      security: { allowedOrigins: ["https://support.example.test"] },
    });

    expect(supportA.projectId).not.toBe(supportB.projectId);
    const customerA = await supportA.auth.resolveCustomer(authContext);
    const visitorA = await supportA.auth.resolveVisitor(authContext);
    const agentA = await supportA.auth.resolveAgent(authContext);
    const limitedAgentA = await supportA.auth.resolveAgent({
      ...authContext,
      headers: { "x-test-agent": "limited" },
    });
    const customerB = await supportB.auth.resolveCustomer(authContext);
    await supportB.auth.resolveVisitor(authContext);
    const agentB = await supportB.auth.resolveAgent(authContext);
    expect(new Set([customerA.id, visitorA.id, agentA.id]).size).toBe(3);

    const createdA = await supportA.conversations.create({
      actor: customerA,
      subject: "Integration checkpoint",
      initialMessage: {
        body: "I need help",
        clientMessageId: "checkpoint-initial-a",
      },
    });
    const createdB = await supportB.conversations.create({
      actor: customerB,
      initialMessage: {
        body: "Project B message",
        clientMessageId: "checkpoint-initial-b",
      },
    });
    expect(
      await supportA.conversations.listForCustomer({ actor: customerA }),
    ).toEqual([expect.objectContaining({ id: createdA.conversation.id })]);
    expect(await supportA.conversations.listInbox({ actor: agentA })).toEqual([
      expect.objectContaining({ id: createdA.conversation.id }),
    ]);

    const assignment = await supportA.conversations.assign({
      actor: agentA,
      conversationId: createdA.conversation.id,
      agentId: agentA.id,
    });
    expect(assignment.agentId).toBe(agentA.id);
    const reply = await supportA.conversations.sendMessage({
      actor: agentA,
      conversationId: createdA.conversation.id,
      body: "We are looking into it",
      clientMessageId: "checkpoint-reply-a",
    });
    const duplicateReply = await supportA.conversations.sendMessage({
      actor: agentA,
      conversationId: createdA.conversation.id,
      body: "A retry may carry a different body",
      clientMessageId: "checkpoint-reply-a",
    });
    expect(duplicateReply.id).toBe(reply.id);

    const note = await supportA.conversations.addInternalNote({
      actor: agentA,
      conversationId: createdA.conversation.id,
      body: "Customer must never see this",
      clientMessageId: "checkpoint-note-a",
    });
    await expectCode(
      supportA.conversations.addInternalNote({
        actor: limitedAgentA,
        conversationId: createdA.conversation.id,
        body: "Unauthorized note",
        clientMessageId: "checkpoint-note-denied-a",
      }),
      "FORBIDDEN",
    );
    const customerMessages = await supportA.messages.list({
      actor: customerA,
      conversationId: createdA.conversation.id,
    });
    expect(customerMessages.map((message) => message.id)).not.toContain(
      note.id,
    );
    expect(
      customerMessages.every((message) => message.type !== "internal_note"),
    ).toBe(true);
    expect(
      await supportA.messages.list({
        actor: agentA,
        conversationId: createdA.conversation.id,
      }),
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: note.id })]),
    );
    await expectCode(
      supportA.messages.recordRead({ actor: customerA, messageId: note.id }),
      "NOT_FOUND",
    );

    const customerReceipt = await supportA.messages.recordRead({
      actor: customerA,
      messageId: reply.id,
    });
    const agentReceipt = await supportA.messages.recordRead({
      actor: agentA,
      messageId: createdA.message.id,
    });
    expect(customerReceipt).toMatchObject({ created: true });
    expect(agentReceipt).toMatchObject({ created: true });

    const tagId = randomUUID();
    const now = new Date();
    await database.tags.save({
      id: tagId,
      projectId: supportA.projectId,
      name: "checkpoint",
      createdAt: now,
      updatedAt: now,
    });
    await supportA.tags.add({
      actor: agentA,
      conversationId: createdA.conversation.id,
      tagId,
    });
    await supportA.tags.remove({
      actor: agentA,
      conversationId: createdA.conversation.id,
      tagId,
    });

    await supportA.conversations.changeStatus({
      actor: agentA,
      conversationId: createdA.conversation.id,
      status: "waiting_for_agent",
    });
    await supportA.conversations.changeStatus({
      actor: agentA,
      conversationId: createdA.conversation.id,
      status: "waiting_for_customer",
    });
    const resolved = await supportA.conversations.changeStatus({
      actor: agentA,
      conversationId: createdA.conversation.id,
      status: "resolved",
    });
    expect(resolved.status).toBe("resolved");
    await expectCode(
      supportA.conversations.changeStatus({
        actor: agentA,
        conversationId: createdA.conversation.id,
        status: "waiting_for_agent",
      }),
      "INVALID_STATE_TRANSITION",
    );
    expect(
      await supportA.conversations.reopen({
        actor: agentA,
        conversationId: createdA.conversation.id,
      }),
    ).toMatchObject({ status: "open" });
    expect(
      await supportA.conversations.markSpam({
        actor: agentA,
        conversationId: createdA.conversation.id,
      }),
    ).toMatchObject({ status: "spam" });

    await expectCode(
      supportB.messages.list({
        actor: agentB,
        conversationId: createdA.conversation.id,
      }),
      "NOT_FOUND",
    );
    await expectCode(
      supportA.messages.list({
        actor: agentA,
        conversationId: createdB.conversation.id,
      }),
      "NOT_FOUND",
    );
    await expectCode(
      supportB.conversations.addInternalNote({
        actor: agentA,
        conversationId: createdB.conversation.id,
        body: "Cross-project actor",
        clientMessageId: "checkpoint-cross-project",
      }),
      "NOT_FOUND",
    );

    await supportA.dispose();
    await expectCode(
      supportA.conversations.listForCustomer({ actor: customerA }),
      "SDK_DISPOSED",
    );
    await supportB.dispose();
  });
});
