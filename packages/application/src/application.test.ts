import { describe, expect, it } from "vitest";
import {
  DomainError,
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
  type ProjectScopedEntity,
  type SavedReply,
  type SupportDatabaseAdapter,
  type SupportRepository,
  type Tag,
} from "@crazyglegit/support-core";
import {
  AddConversationTag,
  AddInternalNote,
  AssignConversation,
  ChangeConversationStatus,
  CreateConversation,
  ListAgentInbox,
  ListConversationMessages,
  ListCustomerConversations,
  MarkConversationAsSpam,
  RecordMessageRead,
  RemoveConversationTag,
  ReopenConversation,
  SendMessage,
  UpsertAgent,
  UpsertCustomer,
  type AgentActor,
  type ApplicationDependencies,
  type ApplicationEvent,
  type CustomerActor,
} from "./index.js";

interface State {
  projects: Project[];
  visitors: AnonymousVisitor[];
  customers: Customer[];
  agents: Agent[];
  conversations: Conversation[];
  participants: ConversationParticipant[];
  assignments: ConversationAssignment[];
  messages: Message[];
  receipts: MessageReceipt[];
  attachments: AttachmentMetadata[];
  tags: Tag[];
  savedReplies: SavedReply[];
  audits: AuditEvent[];
  conversationTags: {
    projectId: string;
    conversationId: string;
    tagId: string;
  }[];
}

function replaceEntity<TEntity extends ProjectScopedEntity>(
  items: TEntity[],
  entity: TEntity,
): TEntity {
  const index = items.findIndex(
    (item) => item.projectId === entity.projectId && item.id === entity.id,
  );
  if (index >= 0) items[index] = entity;
  else items.push(entity);
  return entity;
}

function repository<TEntity extends ProjectScopedEntity>(
  items: TEntity[],
): SupportRepository<TEntity> {
  return {
    findById: ({ projectId, id }) =>
      Promise.resolve(
        items.find((item) => item.projectId === projectId && item.id === id) ??
          null,
      ),
    save: (entity) => Promise.resolve(replaceEntity(items, entity)),
  };
}

class FakeDatabase implements SupportDatabaseAdapter {
  public state: State;
  public failAudit = false;

  public constructor(state?: Partial<State>) {
    this.state = {
      projects: [],
      visitors: [],
      customers: [],
      agents: [],
      conversations: [],
      participants: [],
      assignments: [],
      messages: [],
      receipts: [],
      attachments: [],
      tags: [],
      savedReplies: [],
      audits: [],
      conversationTags: [],
      ...state,
    };
  }

  public readonly projects: SupportDatabaseAdapter["projects"] = {
    create: (project) => {
      this.state.projects.push(project);
      return Promise.resolve(project);
    },
    findById: (id) =>
      Promise.resolve(
        this.state.projects.find((project) => project.id === id) ?? null,
      ),
    findByKey: (projectKey) =>
      Promise.resolve(
        this.state.projects.find(
          (project) => project.projectKey === projectKey,
        ) ?? null,
      ),
    updateMetadata: (id, metadata, updatedAt) => {
      const index = this.state.projects.findIndex(
        (project) => project.id === id,
      );
      const existing = this.state.projects[index];
      if (!existing)
        return Promise.reject(
          new DomainError("NOT_FOUND", "Project was not found."),
        );
      const updated = { ...existing, metadata, updatedAt };
      this.state.projects[index] = updated;
      return Promise.resolve(updated);
    },
  };

  public readonly customers = {
    findById: (key: { projectId: string; id: string }) =>
      repository(this.state.customers).findById(key),
    save: (entity: Customer) => repository(this.state.customers).save(entity),
    findByExternalId: (projectId: string, externalCustomerId: string) =>
      Promise.resolve(
        this.state.customers.find(
          (item) =>
            item.projectId === projectId &&
            item.externalCustomerId === externalCustomerId,
        ) ?? null,
      ),
  };

  public readonly agents = {
    findById: (key: { projectId: string; id: string }) =>
      repository(this.state.agents).findById(key),
    save: (entity: Agent) => repository(this.state.agents).save(entity),
    findByExternalId: (projectId: string, externalAgentId: string) =>
      Promise.resolve(
        this.state.agents.find(
          (item) =>
            item.projectId === projectId &&
            item.externalAgentId === externalAgentId,
        ) ?? null,
      ),
  };

  public readonly visitors = {
    findById: (key: { projectId: string; id: string }) =>
      repository(this.state.visitors).findById(key),
    save: (entity: AnonymousVisitor) =>
      repository(this.state.visitors).save(entity),
    findByExternalId: (projectId: string, externalVisitorId: string) =>
      Promise.resolve(
        this.state.visitors.find(
          (item) =>
            item.projectId === projectId &&
            item.externalVisitorId === externalVisitorId,
        ) ?? null,
      ),
  };

  public readonly conversations = {
    findById: (key: { projectId: string; id: string }) =>
      repository(this.state.conversations).findById(key),
    save: (entity: Conversation) =>
      repository(this.state.conversations).save(entity),
    listByParticipant: (
      projectId: string,
      participantType: ConversationParticipant["participantType"],
      participantId: string,
    ) => {
      const ids = new Set(
        this.state.participants
          .filter(
            (item) =>
              item.projectId === projectId &&
              item.participantType === participantType &&
              item.participantId === participantId,
          )
          .map((item) => item.conversationId),
      );
      return Promise.resolve(
        this.state.conversations.filter(
          (item) => item.projectId === projectId && ids.has(item.id),
        ),
      );
    },
    listInbox: (projectId: string, agentId?: string) => {
      if (!agentId)
        return Promise.resolve(
          this.state.conversations.filter(
            (item) => item.projectId === projectId,
          ),
        );
      const ids = new Set(
        this.state.assignments
          .filter(
            (item) =>
              item.projectId === projectId &&
              item.agentId === agentId &&
              !item.unassignedAt,
          )
          .map((item) => item.conversationId),
      );
      return Promise.resolve(
        this.state.conversations.filter(
          (item) => item.projectId === projectId && ids.has(item.id),
        ),
      );
    },
  };

  public readonly participants = {
    findById: (key: { projectId: string; id: string }) =>
      repository(this.state.participants).findById(key),
    save: (entity: ConversationParticipant) =>
      repository(this.state.participants).save(entity),
    findParticipant: (
      projectId: string,
      conversationId: string,
      participantType: ConversationParticipant["participantType"],
      participantId: string,
    ) =>
      Promise.resolve(
        this.state.participants.find(
          (item) =>
            item.projectId === projectId &&
            item.conversationId === conversationId &&
            item.participantType === participantType &&
            item.participantId === participantId,
        ) ?? null,
      ),
  };

  public readonly assignments = {
    findById: (key: { projectId: string; id: string }) =>
      repository(this.state.assignments).findById(key),
    save: (entity: ConversationAssignment) =>
      repository(this.state.assignments).save(entity),
    findActive: (projectId: string, conversationId: string) =>
      Promise.resolve(
        this.state.assignments.find(
          (item) =>
            item.projectId === projectId &&
            item.conversationId === conversationId &&
            !item.unassignedAt,
        ) ?? null,
      ),
  };

  public readonly messages = {
    findById: (key: { projectId: string; id: string }) =>
      repository(this.state.messages).findById(key),
    save: (entity: Message) => repository(this.state.messages).save(entity),
    findByClientMessageId: (
      projectId: string,
      conversationId: string,
      clientMessageId: string,
    ) =>
      Promise.resolve(
        this.state.messages.find(
          (item) =>
            item.projectId === projectId &&
            item.conversationId === conversationId &&
            item.clientMessageId === clientMessageId,
        ) ?? null,
      ),
    listByConversation: (projectId: string, conversationId: string) =>
      Promise.resolve(
        this.state.messages.filter(
          (item) =>
            item.projectId === projectId &&
            item.conversationId === conversationId,
        ),
      ),
  };

  public readonly messageReceipts = {
    create: (entity: MessageReceipt) => {
      const duplicate = this.state.receipts.find(
        (item) =>
          item.projectId === entity.projectId &&
          item.messageId === entity.messageId &&
          item.readerType === entity.readerType &&
          item.readerId === entity.readerId &&
          item.id !== entity.id,
      );
      if (duplicate) return Promise.reject(new Error("duplicate receipt"));
      return repository(this.state.receipts).save(entity);
    },
    findByMessageAndReader: (
      projectId: string,
      messageId: string,
      readerType: MessageReceipt["readerType"],
      readerId: string,
    ) =>
      Promise.resolve(
        this.state.receipts.find(
          (item) =>
            item.projectId === projectId &&
            item.messageId === messageId &&
            item.readerType === readerType &&
            item.readerId === readerId,
        ) ?? null,
      ),
  };

  public get attachments() {
    return repository(this.state.attachments);
  }
  public get tags() {
    return repository(this.state.tags);
  }
  public get savedReplies() {
    return repository(this.state.savedReplies);
  }
  public readonly conversationTags = {
    add: (projectId: string, conversationId: string, tagId: string) => {
      this.state.conversationTags.push({ projectId, conversationId, tagId });
      return Promise.resolve();
    },
    remove: (projectId: string, conversationId: string, tagId: string) => {
      this.state.conversationTags = this.state.conversationTags.filter(
        (item) =>
          !(
            item.projectId === projectId &&
            item.conversationId === conversationId &&
            item.tagId === tagId
          ),
      );
      return Promise.resolve();
    },
  };
  public readonly audit = {
    append: (event: AuditEvent) => {
      if (this.failAudit) return Promise.reject(new Error("audit unavailable"));
      this.state.audits.push(event);
      return Promise.resolve();
    },
  };

  public async transaction<TResult>(
    operation: (database: SupportDatabaseAdapter) => Promise<TResult>,
  ): Promise<TResult> {
    const snapshot = structuredClone(this.state);
    try {
      return await operation(this);
    } catch (error) {
      this.state = snapshot;
      throw error;
    }
  }
}

const now = new Date("2026-07-31T12:00:00.000Z");
const customer: CustomerActor = { type: "customer", id: "customer-1" };
const otherCustomer: CustomerActor = { type: "customer", id: "customer-2" };
const readerAgent: AgentActor = {
  type: "agent",
  id: "agent-1",
  permissions: ["conversation.read"],
};
const manager: AgentActor = {
  type: "agent",
  id: "agent-1",
  permissions: [
    "conversation.read",
    "conversation.reply",
    "conversation.assign",
    "conversation.close",
    "conversation.reopen",
    "conversation.mark_spam",
    "internal_note.create",
    "internal_note.read",
  ],
};

function baseState(): Partial<State> {
  return {
    agents: [
      {
        id: "agent-1",
        projectId: "project-1",
        externalAgentId: "host-agent-1",
        name: "Agent",
        role: "support_agent",
        permissions: manager.permissions,
        createdAt: now,
        updatedAt: now,
      },
    ],
    conversations: [
      {
        id: "conversation-1",
        projectId: "project-1",
        status: "open",
        createdAt: now,
        updatedAt: now,
      },
    ],
    participants: [
      {
        id: "participant-1",
        projectId: "project-1",
        conversationId: "conversation-1",
        participantId: "customer-1",
        participantType: "customer",
        createdAt: now,
        updatedAt: now,
      },
    ],
    messages: [
      {
        id: "message-1",
        projectId: "project-1",
        conversationId: "conversation-1",
        type: "text",
        senderType: "agent",
        senderId: "agent-1",
        body: "Hello",
        deliveryStatus: "delivered",
        clientMessageId: "message-01",
        createdAt: now,
        updatedAt: now,
      },
    ],
    tags: [
      {
        id: "tag-1",
        projectId: "project-1",
        name: "Billing",
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

function harness(state = baseState()) {
  const database = new FakeDatabase(state);
  const events: ApplicationEvent[] = [];
  let sequence = 0;
  const dependencies: ApplicationDependencies = {
    database,
    clock: { now: () => now },
    ids: { generate: () => `generated-${String(++sequence)}` },
    events: {
      publish: (event) => {
        events.push(event);
        return Promise.resolve();
      },
    },
  };
  return { database, events, dependencies };
}

async function expectCode(
  operation: Promise<unknown>,
  code: DomainError["code"],
): Promise<void> {
  await expect(operation).rejects.toMatchObject({ code });
}

describe("conversation and message workflows", () => {
  it("creates a conversation, participant, initial message, audit, and events atomically", async () => {
    const { database, dependencies, events } = harness({});
    const result = await new CreateConversation(dependencies).execute({
      projectId: "project-1",
      actor: customer,
      initialMessage: { body: "Help", clientMessageId: "initial-01" },
    });
    expect(database.state.conversations).toHaveLength(1);
    expect(database.state.participants).toHaveLength(1);
    expect(result.message.conversationId).toBe(result.conversation.id);
    expect(database.state.audits).toHaveLength(1);
    expect(events.map((event) => event.type)).toEqual([
      "conversation.created",
      "message.created",
    ]);
  });

  it("enforces customer ownership, agent permissions, and project isolation", async () => {
    const { dependencies } = harness();
    const send = new SendMessage(dependencies);
    await expectCode(
      send.execute({
        projectId: "project-1",
        conversationId: "conversation-1",
        actor: otherCustomer,
        body: "No",
        clientMessageId: "denied-01",
      }),
      "FORBIDDEN",
    );
    await expectCode(
      send.execute({
        projectId: "project-1",
        conversationId: "conversation-1",
        actor: { type: "agent", id: "agent-1", permissions: [] },
        body: "No",
        clientMessageId: "denied-02",
      }),
      "FORBIDDEN",
    );
    await expectCode(
      send.execute({
        projectId: "project-2",
        conversationId: "conversation-1",
        actor: customer,
        body: "No",
        clientMessageId: "denied-03",
      }),
      "NOT_FOUND",
    );
  });

  it("returns the original message for an idempotent retry and emits once", async () => {
    const { database, dependencies, events } = harness();
    const send = new SendMessage(dependencies);
    const input = {
      projectId: "project-1",
      conversationId: "conversation-1",
      actor: customer,
      body: "Again",
      clientMessageId: "retry-id-1",
    } as const;
    const first = await send.execute(input);
    const second = await send.execute(input);
    expect(second).toBe(first);
    expect(
      database.state.messages.filter(
        (message) => message.clientMessageId === "retry-id-1",
      ),
    ).toHaveLength(1);
    expect(
      events.filter((event) => event.type === "message.created"),
    ).toHaveLength(1);
  });

  it("protects internal notes and customer message visibility", async () => {
    const { dependencies } = harness();
    await expectCode(
      new AddInternalNote(dependencies).execute({
        projectId: "project-1",
        conversationId: "conversation-1",
        actor: customer as unknown as AgentActor,
        body: "secret",
        clientMessageId: "note-id-00",
      }),
      "FORBIDDEN",
    );
    await expectCode(
      new AddInternalNote(dependencies).execute({
        projectId: "project-1",
        conversationId: "conversation-1",
        actor: { type: "agent", id: "agent-1", permissions: [] },
        body: "secret",
        clientMessageId: "note-id-01",
      }),
      "FORBIDDEN",
    );
    await new AddInternalNote(dependencies).execute({
      projectId: "project-1",
      conversationId: "conversation-1",
      actor: manager,
      body: "secret",
      clientMessageId: "note-id-01",
    });
    const customerMessages = await new ListConversationMessages(
      dependencies,
    ).execute({
      projectId: "project-1",
      conversationId: "conversation-1",
      actor: customer,
    });
    expect(
      customerMessages.every((message) => message.type !== "internal_note"),
    ).toBe(true);
    expect(
      await new ListConversationMessages(dependencies).execute({
        projectId: "project-1",
        conversationId: "conversation-1",
        actor: manager,
      }),
    ).toHaveLength(2);
  });

  it("rolls back message and audit state when a transactional dependency fails", async () => {
    const { database, dependencies, events } = harness();
    database.failAudit = true;
    await expectCode(
      new SendMessage(dependencies).execute({
        projectId: "project-1",
        conversationId: "conversation-1",
        actor: customer,
        body: "rollback",
        clientMessageId: "rollback-1",
      }),
      "INTERNAL_ERROR",
    );
    expect(database.state.messages).toHaveLength(1);
    expect(events).toHaveLength(0);
  });
});

describe("assignment and lifecycle workflows", () => {
  it("assigns, preserves history, and lists the assigned inbox", async () => {
    const { database, dependencies, events } = harness();
    const assignment = await new AssignConversation(dependencies).execute({
      projectId: "project-1",
      conversationId: "conversation-1",
      actor: manager,
      agentId: "agent-1",
    });
    expect(assignment.agentId).toBe("agent-1");
    expect(database.state.audits.at(-1)?.action).toBe("conversation.assigned");
    expect(
      await new ListAgentInbox(dependencies).execute({
        projectId: "project-1",
        actor: readerAgent,
        assignedToAgentId: "agent-1",
      }),
    ).toHaveLength(1);
    expect(events.at(-1)?.type).toBe("conversation.assigned");
  });

  it("rejects invalid transitions and supports explicit reopen and spam permissions", async () => {
    const { database, dependencies } = harness();
    const existingConversation = database.state.conversations[0];
    if (!existingConversation) throw new Error("fixture conversation missing");
    database.state.conversations[0] = {
      ...existingConversation,
      status: "closed",
    };
    await expectCode(
      new ChangeConversationStatus(dependencies).execute({
        projectId: "project-1",
        conversationId: "conversation-1",
        actor: manager,
        status: "resolved",
      }),
      "INVALID_STATE_TRANSITION",
    );
    expect(
      (
        await new ReopenConversation(dependencies).execute({
          projectId: "project-1",
          conversationId: "conversation-1",
          actor: manager,
        })
      ).status,
    ).toBe("open");
    expect(
      (
        await new MarkConversationAsSpam(dependencies).execute({
          projectId: "project-1",
          conversationId: "conversation-1",
          actor: manager,
        })
      ).status,
    ).toBe("spam");
  });
});

describe("message receipts", () => {
  it("records customer and agent readers independently and emits only on first read", async () => {
    const { database, dependencies, events } = harness();
    const record = new RecordMessageRead(dependencies);
    const customerRead = await record.execute({
      projectId: "project-1",
      messageId: "message-1",
      actor: customer,
    });
    const duplicate = await record.execute({
      projectId: "project-1",
      messageId: "message-1",
      actor: customer,
    });
    expect(
      events.filter((event) => event.type === "message.read"),
    ).toHaveLength(1);
    const agentRead = await record.execute({
      projectId: "project-1",
      messageId: "message-1",
      actor: readerAgent,
    });
    expect(customerRead.created).toBe(true);
    expect(duplicate).toEqual({
      receipt: customerRead.receipt,
      created: false,
    });
    expect(agentRead.created).toBe(true);
    expect(database.state.receipts).toHaveLength(2);
    expect(
      new Set(database.state.receipts.map((receipt) => receipt.readerId)).size,
    ).toBe(2);
    expect(database.state.messages[0]?.deliveryStatus).toBe("delivered");
    expect(
      events.filter((event) => event.type === "message.read"),
    ).toHaveLength(2);
  });

  it("rejects cross-project and non-owner reads", async () => {
    const { dependencies } = harness();
    const record = new RecordMessageRead(dependencies);
    await expectCode(
      record.execute({
        projectId: "project-2",
        messageId: "message-1",
        actor: customer,
      }),
      "NOT_FOUND",
    );
    await expectCode(
      record.execute({
        projectId: "project-1",
        messageId: "message-1",
        actor: otherCustomer,
      }),
      "FORBIDDEN",
    );
    const note = await new AddInternalNote(dependencies).execute({
      projectId: "project-1",
      conversationId: "conversation-1",
      actor: manager,
      body: "hidden",
      clientMessageId: "hidden-note-1",
    });
    await expectCode(
      record.execute({
        projectId: "project-1",
        messageId: note.id,
        actor: customer,
      }),
      "NOT_FOUND",
    );
  });
});

describe("remaining application catalog", () => {
  it("upserts identities, lists ownership, and adds/removes tags", async () => {
    const { database, dependencies } = harness();
    const createdCustomer = await new UpsertCustomer(dependencies).execute({
      projectId: "project-1",
      externalCustomerId: "host-customer",
      name: "Customer",
    });
    const updatedCustomer = await new UpsertCustomer(dependencies).execute({
      projectId: "project-1",
      externalCustomerId: "host-customer",
      name: "Updated",
    });
    expect(updatedCustomer.id).toBe(createdCustomer.id);
    await new UpsertAgent(dependencies).execute({
      projectId: "project-1",
      externalAgentId: "host-agent-2",
      name: "Agent Two",
      role: "support_agent",
      permissions: ["conversation.read"],
    });
    expect(database.state.agents).toHaveLength(2);
    expect(
      await new ListCustomerConversations(dependencies).execute({
        projectId: "project-1",
        actor: customer,
      }),
    ).toHaveLength(1);
    const tagInput = {
      projectId: "project-1",
      conversationId: "conversation-1",
      tagId: "tag-1",
      actor: manager,
    };
    await new AddConversationTag(dependencies).execute(tagInput);
    expect(database.state.conversationTags).toHaveLength(1);
    await new RemoveConversationTag(dependencies).execute(tagInput);
    expect(database.state.conversationTags).toHaveLength(0);
  });
});
