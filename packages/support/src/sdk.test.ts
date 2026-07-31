import { describe, expect, it, vi } from "vitest";
import type {
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
  SupportDatabaseAdapter,
  SupportRepository,
  Tag,
} from "@crazyglegit/support-core";
import type {
  AgentIdentity,
  CustomerIdentity,
  SupportAuthAdapter,
  VisitorIdentity,
} from "@crazyglegit/support-contracts";
import { createSupportKit, SupportKitError } from "./index.js";

function repo<TEntity extends ProjectScopedEntity>(
  items: TEntity[],
): SupportRepository<TEntity> {
  return {
    findById: ({ projectId, id }) =>
      Promise.resolve(
        items.find((item) => item.projectId === projectId && item.id === id) ??
          null,
      ),
    save: (entity) => {
      const index = items.findIndex(
        (item) => item.projectId === entity.projectId && item.id === entity.id,
      );
      if (index >= 0) items[index] = entity;
      else items.push(entity);
      return Promise.resolve(entity);
    },
  };
}

class FakeDatabase implements SupportDatabaseAdapter {
  public readonly projectItems: Project[] = [];
  public readonly customerItems: Customer[] = [];
  public readonly agentItems: Agent[] = [];
  public readonly visitorItems: AnonymousVisitor[] = [];
  public readonly conversationItems: Conversation[] = [];
  public readonly participantItems: ConversationParticipant[] = [];
  public readonly assignmentItems: ConversationAssignment[] = [];
  public readonly messageItems: Message[] = [];
  public readonly receiptItems: MessageReceipt[] = [];
  public readonly attachmentItems: AttachmentMetadata[] = [];
  public readonly tagItems: Tag[] = [];
  public readonly savedReplyItems: SavedReply[] = [];
  public readonly auditItems: AuditEvent[] = [];
  public disposeCalls = 0;

  public readonly projects = {
    create: (project: Project) => {
      this.projectItems.push(project);
      return Promise.resolve(project);
    },
    findById: (id: string) =>
      Promise.resolve(this.projectItems.find((item) => item.id === id) ?? null),
    findByKey: (key: string) =>
      Promise.resolve(
        this.projectItems.find((item) => item.projectKey === key) ?? null,
      ),
    updateMetadata: (
      id: string,
      metadata: Readonly<Record<string, unknown>>,
      updatedAt: Date,
    ) => {
      const project = this.projectItems.find((item) => item.id === id);
      if (!project) return Promise.reject(new Error("missing"));
      const updated = { ...project, metadata, updatedAt };
      this.projectItems[this.projectItems.indexOf(project)] = updated;
      return Promise.resolve(updated);
    },
  };
  public readonly customers = {
    ...repo(this.customerItems),
    findByExternalId: (projectId: string, externalCustomerId: string) =>
      Promise.resolve(
        this.customerItems.find(
          (item) =>
            item.projectId === projectId &&
            item.externalCustomerId === externalCustomerId,
        ) ?? null,
      ),
    save: (entity: Customer) => {
      const existing = this.customerItems.find(
        (item) =>
          item.projectId === entity.projectId &&
          item.externalCustomerId === entity.externalCustomerId,
      );
      return repo(this.customerItems).save(
        existing
          ? { ...entity, id: existing.id, createdAt: existing.createdAt }
          : entity,
      );
    },
  };
  public readonly agents = {
    ...repo(this.agentItems),
    findByExternalId: (projectId: string, externalAgentId: string) =>
      Promise.resolve(
        this.agentItems.find(
          (item) =>
            item.projectId === projectId &&
            item.externalAgentId === externalAgentId,
        ) ?? null,
      ),
    save: (entity: Agent) => {
      const existing = this.agentItems.find(
        (item) =>
          item.projectId === entity.projectId &&
          item.externalAgentId === entity.externalAgentId,
      );
      return repo(this.agentItems).save(
        existing
          ? { ...entity, id: existing.id, createdAt: existing.createdAt }
          : entity,
      );
    },
  };
  public readonly visitors = {
    ...repo(this.visitorItems),
    findByExternalId: (projectId: string, externalVisitorId: string) =>
      Promise.resolve(
        this.visitorItems.find(
          (item) =>
            item.projectId === projectId &&
            item.externalVisitorId === externalVisitorId,
        ) ?? null,
      ),
    save: (entity: AnonymousVisitor) => {
      const existing = this.visitorItems.find(
        (item) =>
          item.projectId === entity.projectId &&
          item.externalVisitorId === entity.externalVisitorId,
      );
      return repo(this.visitorItems).save(
        existing
          ? { ...entity, id: existing.id, createdAt: existing.createdAt }
          : entity,
      );
    },
  };
  public readonly conversations = {
    ...repo(this.conversationItems),
    listByParticipant: (
      projectId: string,
      participantType: ConversationParticipant["participantType"],
      participantId: string,
    ) => {
      const ids = new Set(
        this.participantItems
          .filter(
            (item) =>
              item.projectId === projectId &&
              item.participantType === participantType &&
              item.participantId === participantId,
          )
          .map((item) => item.conversationId),
      );
      return Promise.resolve(
        this.conversationItems.filter(
          (item) => item.projectId === projectId && ids.has(item.id),
        ),
      );
    },
    listInbox: (projectId: string) =>
      Promise.resolve(
        this.conversationItems.filter((item) => item.projectId === projectId),
      ),
  };
  public readonly participants = {
    ...repo(this.participantItems),
    findParticipant: (
      projectId: string,
      conversationId: string,
      participantType: ConversationParticipant["participantType"],
      participantId: string,
    ) =>
      Promise.resolve(
        this.participantItems.find(
          (item) =>
            item.projectId === projectId &&
            item.conversationId === conversationId &&
            item.participantType === participantType &&
            item.participantId === participantId,
        ) ?? null,
      ),
  };
  public readonly assignments = {
    ...repo(this.assignmentItems),
    findActive: (projectId: string, conversationId: string) =>
      Promise.resolve(
        this.assignmentItems.find(
          (item) =>
            item.projectId === projectId &&
            item.conversationId === conversationId &&
            !item.unassignedAt,
        ) ?? null,
      ),
  };
  public readonly messages = {
    ...repo(this.messageItems),
    findByClientMessageId: (
      projectId: string,
      conversationId: string,
      clientMessageId: string,
    ) =>
      Promise.resolve(
        this.messageItems.find(
          (item) =>
            item.projectId === projectId &&
            item.conversationId === conversationId &&
            item.clientMessageId === clientMessageId,
        ) ?? null,
      ),
    listByConversation: (projectId: string, conversationId: string) =>
      Promise.resolve(
        this.messageItems.filter(
          (item) =>
            item.projectId === projectId &&
            item.conversationId === conversationId,
        ),
      ),
  };
  public readonly messageReceipts = {
    findByMessageAndReader: (
      projectId: string,
      messageId: string,
      readerType: MessageReceipt["readerType"],
      readerId: string,
    ) =>
      Promise.resolve(
        this.receiptItems.find(
          (item) =>
            item.projectId === projectId &&
            item.messageId === messageId &&
            item.readerType === readerType &&
            item.readerId === readerId,
        ) ?? null,
      ),
    create: (entity: MessageReceipt) => repo(this.receiptItems).save(entity),
  };
  public get attachments() {
    return repo(this.attachmentItems);
  }
  public get tags() {
    return repo(this.tagItems);
  }
  public get savedReplies() {
    return repo(this.savedReplyItems);
  }
  public readonly conversationTags = {
    add: () => Promise.resolve(),
    remove: () => Promise.resolve(),
  };
  public readonly audit = {
    append: (event: AuditEvent) => {
      this.auditItems.push(event);
      return Promise.resolve();
    },
  };
  public transaction<TResult>(
    operation: (database: SupportDatabaseAdapter) => Promise<TResult>,
  ): Promise<TResult> {
    return operation(this);
  }
  public healthCheck(): Promise<void> {
    return Promise.resolve();
  }
  public dispose(): Promise<void> {
    this.disposeCalls += 1;
    return Promise.resolve();
  }
}

class FakeAuth implements SupportAuthAdapter {
  public customer: CustomerIdentity | null = { id: "host-customer" };
  public visitor: VisitorIdentity | null = {
    id: "host-visitor",
    sessionId: "verified-session",
  };
  public agent: AgentIdentity | null = {
    id: "host-agent",
    name: "Agent",
    role: "support_agent",
    permissions: ["conversation.read"],
  };
  public disposeCalls = 0;
  public getCustomer = () => Promise.resolve(this.customer);
  public getVisitor = () => Promise.resolve(this.visitor);
  public getAgent = () => Promise.resolve(this.agent);
  public healthCheck = () => Promise.resolve({ status: "healthy" as const });
  public dispose = () => {
    this.disposeCalls += 1;
    return Promise.resolve();
  };
}

function config(
  database: FakeDatabase,
  auth = new FakeAuth(),
  key = "main-app",
) {
  return {
    projectKey: key,
    database,
    auth,
    security: { allowedOrigins: ["https://example.com"] },
    projectInitialization: { mode: "create-if-missing" as const, name: key },
  };
}

describe("public SDK composition", () => {
  it("initializes, resolves the key once, and injects projectId", async () => {
    const database = new FakeDatabase();
    const support = await createSupportKit(config(database));
    const customer = await support.customers.upsert({
      externalCustomerId: "direct",
    });
    expect(customer.projectId).toBe(support.projectId);
    expect(database.projectItems).toHaveLength(1);
    expect("database" in support).toBe(false);
    expect(Object.keys(support)).not.toContain("config");
    expect(JSON.stringify(support)).not.toContain("projects");
  });

  it("returns NOT_FOUND for an unknown project by default", async () => {
    const database = new FakeDatabase();
    await expect(
      createSupportKit({
        projectKey: "missing",
        database,
        auth: new FakeAuth(),
        security: { allowedOrigins: ["https://example.com"] },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("validates configuration and feature combinations", async () => {
    await expect(
      createSupportKit({
        ...config(new FakeDatabase()),
        projectKey: "bad key",
      }),
    ).rejects.toMatchObject({ code: "CONFIGURATION_ERROR" });
    await expect(
      createSupportKit({
        ...config(new FakeDatabase()),
        features: { attachments: true },
      }),
    ).rejects.toMatchObject({ code: "CONFIGURATION_ERROR" });
  });

  it("resolves customer, agent, and visitor identities to internal actors", async () => {
    const database = new FakeDatabase();
    const support = await createSupportKit(config(database));
    const customer = await support.auth.resolveCustomer({
      method: "GET",
      url: "https://example.com",
      headers: {},
    });
    const visitor = await support.auth.resolveVisitor({
      method: "GET",
      url: "https://example.com",
      headers: {},
    });
    const agent = await support.auth.resolveAgent({
      method: "GET",
      url: "https://example.com",
      headers: {},
    });
    expect(customer).toMatchObject({
      type: "customer",
      id: database.customerItems[0]?.id,
    });
    expect(visitor).toMatchObject({
      type: "visitor",
      id: database.visitorItems[0]?.id,
    });
    expect(agent).toMatchObject({
      type: "agent",
      id: database.agentItems[0]?.id,
      role: "support_agent",
      permissions: ["conversation.read"],
    });
  });

  it("notifies and unsubscribes post-commit SDK event listeners", async () => {
    const support = await createSupportKit(config(new FakeDatabase()));
    const listener = vi.fn();
    const unsubscribe = support.events.subscribe(listener);
    await support.auth.resolveCustomer({
      method: "GET",
      url: "https://example.com",
      headers: {},
    });
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "customer.updated" }),
    );
    unsubscribe();
    listener.mockClear();
    await support.auth.resolveCustomer({
      method: "GET",
      url: "https://example.com",
      headers: {},
    });
    expect(listener).not.toHaveBeenCalled();
  });

  it("provisions visitors idempotently without merging customers", async () => {
    const database = new FakeDatabase();
    const support = await createSupportKit(config(database));
    const context = { method: "GET", url: "https://example.com", headers: {} };
    const first = await support.auth.resolveVisitor(context);
    const second = await support.auth.resolveVisitor(context);
    expect(second.id).toBe(first.id);
    expect(database.visitorItems).toHaveLength(1);
    expect(database.customerItems).toHaveLength(0);
  });

  it("requires an explicit valid agent role and never infers one", async () => {
    const database = new FakeDatabase();
    const auth = new FakeAuth();
    auth.getAgent = () =>
      Promise.resolve({
        id: "agent",
        name: "Agent",
        permissions: ["conversation.read"],
      } as never);
    const support = await createSupportKit(config(database, auth));
    await expect(
      support.auth.resolveAgent({
        method: "GET",
        url: "https://example.com",
        headers: {},
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(database.agentItems).toHaveLength(0);
  });

  it("rejects invalid verified visitor identities", async () => {
    const database = new FakeDatabase();
    const auth = new FakeAuth();
    auth.getVisitor = () => Promise.resolve({ id: "" } as never);
    const support = await createSupportKit(config(database, auth));
    await expect(
      support.auth.resolveVisitor({
        method: "GET",
        url: "https://example.com",
        headers: {},
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("isolates visitor records across SDK projects without global state", async () => {
    const database = new FakeDatabase();
    const auth = new FakeAuth();
    const first = await createSupportKit(config(database, auth, "first"));
    const second = await createSupportKit(config(database, auth, "second"));
    const context = { method: "GET", url: "https://example.com", headers: {} };
    const firstActor = await first.auth.resolveVisitor(context);
    const secondActor = await second.auth.resolveVisitor(context);
    expect(firstActor.id).not.toBe(secondActor.id);
    expect(database.visitorItems.map((item) => item.projectId)).toEqual(
      expect.arrayContaining([first.projectId, second.projectId]),
    );
  });

  it("reports adapter availability without probing missing adapters", async () => {
    const support = await createSupportKit(config(new FakeDatabase()));
    const health = await support.healthCheck();
    expect(health.status).toBe("healthy");
    expect(health.checks.realtime.status).toBe("disabled");
    expect(health.checks.storage.status).toBe("disabled");
  });

  it("reports degraded health when a configured adapter lacks a health check", async () => {
    const auth = new FakeAuth();
    auth.healthCheck = undefined as never;
    const support = await createSupportKit(config(new FakeDatabase(), auth));
    expect((await support.healthCheck()).status).toBe("degraded");
  });

  it("disposes owned adapters once and rejects later operations", async () => {
    const database = new FakeDatabase();
    const auth = new FakeAuth();
    const support = await createSupportKit({
      ...config(database, auth),
      lifecycle: { adapterOwnership: "sdk" },
    });
    await support.dispose();
    await support.dispose();
    expect(database.disposeCalls).toBe(1);
    expect(auth.disposeCalls).toBe(1);
    await expect(
      support.customers.upsert({ externalCustomerId: "late" }),
    ).rejects.toBeInstanceOf(SupportKitError);
    await expect(
      support.customers.upsert({ externalCustomerId: "late" }),
    ).rejects.toMatchObject({ code: "SDK_DISPOSED" });
  });
});
