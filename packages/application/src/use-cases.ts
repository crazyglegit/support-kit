import {
  assertConversationTransition,
  assertValidClientMessageId,
  DomainError,
  isCustomerVisibleMessage,
  type Agent,
  type AnonymousVisitor,
  type Conversation,
  type ConversationAssignment,
  type ConversationParticipant,
  type Customer,
  type Message,
  type MessageReceipt,
  type SupportDatabaseAdapter,
} from "@crazyglegit/support-core";
import type { ApplicationEvent } from "./events.js";
import {
  applicationEvent,
  auditEvent,
  publishEvents,
  requireConversation,
  requireConversationAccess,
  requirePermission,
  requireValue,
  runtimeActorType,
  safely,
} from "./helpers.js";
import type {
  AddInternalNoteInput,
  ApplicationDependencies,
  AssignConversationInput,
  ChangeConversationStatusInput,
  ConversationTagInput,
  CreateConversationInput,
  CreateConversationResult,
  ListAgentInboxInput,
  ListConversationMessagesInput,
  ListCustomerConversationsInput,
  MarkConversationAsSpamInput,
  RecordMessageReadInput,
  RecordMessageReadResult,
  ReopenConversationInput,
  SendMessageInput,
  UpsertAgentInput,
  UpsertCustomerInput,
  UpsertVisitorInput,
} from "./types.js";

interface TransactionResult<TResult> {
  readonly result: TResult;
  readonly events: readonly ApplicationEvent[];
}

async function transactional<TResult>(
  dependencies: ApplicationDependencies,
  operation: (
    database: SupportDatabaseAdapter,
  ) => Promise<TransactionResult<TResult>>,
): Promise<TResult> {
  return safely(async () => {
    const completed = await dependencies.database.transaction(operation);
    await publishEvents(dependencies, completed.events);
    return completed.result;
  });
}

function createMessage(
  dependencies: ApplicationDependencies,
  input: {
    projectId: string;
    conversationId: string;
    actor: { readonly type: Message["senderType"]; readonly id: string };
    body: string;
    clientMessageId: string;
    type: Message["type"];
  },
): Message {
  requireValue(input.body, "body");
  assertValidClientMessageId(input.clientMessageId);
  const now = dependencies.clock.now();
  return {
    id: dependencies.ids.generate(),
    projectId: input.projectId,
    conversationId: input.conversationId,
    senderType: input.actor.type,
    senderId: input.actor.id,
    type: input.type,
    body: input.body,
    clientMessageId: input.clientMessageId,
    deliveryStatus: "pending",
    createdAt: now,
    updatedAt: now,
  };
}

async function existingMessage(
  database: SupportDatabaseAdapter,
  input: { projectId: string; conversationId: string; clientMessageId: string },
): Promise<Message | null> {
  return database.messages.findByClientMessageId(
    input.projectId,
    input.conversationId,
    input.clientMessageId,
  );
}

/** Creates a customer-owned conversation and initial message atomically. */
export class CreateConversation {
  public constructor(private readonly dependencies: ApplicationDependencies) {}

  public execute(
    input: CreateConversationInput,
  ): Promise<CreateConversationResult> {
    return transactional(this.dependencies, async (database) => {
      requireValue(input.projectId, "projectId");
      requireValue(input.actor.id, "actor.id");
      const actorType = runtimeActorType(input.actor);
      if (actorType !== "customer" && actorType !== "visitor") {
        throw new DomainError(
          "FORBIDDEN",
          "Only customers and visitors may create conversations.",
        );
      }
      const now = this.dependencies.clock.now();
      const conversation: Conversation = {
        id: this.dependencies.ids.generate(),
        projectId: input.projectId,
        status: "open",
        ...(input.subject ? { subject: input.subject } : {}),
        createdAt: now,
        updatedAt: now,
      };
      const message = createMessage(this.dependencies, {
        projectId: input.projectId,
        conversationId: conversation.id,
        actor: input.actor,
        body: input.initialMessage.body,
        clientMessageId: input.initialMessage.clientMessageId,
        type: "text",
      });
      const participant: ConversationParticipant = {
        id: this.dependencies.ids.generate(),
        projectId: input.projectId,
        conversationId: conversation.id,
        participantId: input.actor.id,
        participantType: input.actor.type,
        createdAt: now,
        updatedAt: now,
      };
      await database.conversations.save(conversation);
      await database.participants.save(participant);
      await database.messages.save(message);
      await database.audit.append(
        auditEvent(this.dependencies, {
          projectId: input.projectId,
          action: "conversation.created",
          actor: input.actor,
          resourceId: conversation.id,
          resourceType: "conversation",
        }),
      );
      return {
        result: { conversation, message },
        events: [
          applicationEvent(
            this.dependencies,
            "conversation.created",
            input.projectId,
            { conversationId: conversation.id },
            conversation.id,
          ),
          applicationEvent(
            this.dependencies,
            "message.created",
            input.projectId,
            { messageId: message.id },
            conversation.id,
          ),
        ],
      };
    });
  }
}

/** Sends a public message with client-message idempotency. */
export class SendMessage {
  public constructor(private readonly dependencies: ApplicationDependencies) {}

  public execute(input: SendMessageInput): Promise<Message> {
    return transactional(this.dependencies, async (database) => {
      requireValue(input.projectId, "projectId");
      requireValue(input.conversationId, "conversationId");
      assertValidClientMessageId(input.clientMessageId);
      await requireConversationAccess(
        database,
        input.projectId,
        input.conversationId,
        input.actor,
        "conversation.reply",
      );
      const duplicate = await existingMessage(database, input);
      if (duplicate) {
        if (
          duplicate.senderType !== input.actor.type ||
          duplicate.senderId !== input.actor.id ||
          duplicate.type === "internal_note"
        ) {
          throw new DomainError(
            "CONFLICT",
            "Client message ID is already used by another message.",
          );
        }
        return { result: duplicate, events: [] };
      }
      const requestedType: string = input.type ?? "text";
      if (
        requestedType === "internal_note" ||
        requestedType === "bot" ||
        requestedType === "system" ||
        !["text", "image", "file", "quick_reply"].includes(requestedType)
      ) {
        throw new DomainError(
          "FORBIDDEN",
          "This message type cannot be created through SendMessage.",
        );
      }
      const type = requestedType as Exclude<
        Message["type"],
        "internal_note" | "bot" | "system"
      >;
      const message = createMessage(this.dependencies, { ...input, type });
      await database.messages.save(message);
      await database.audit.append(
        auditEvent(this.dependencies, {
          projectId: input.projectId,
          action: "message.created",
          actor: input.actor,
          resourceId: message.id,
          resourceType: "message",
          metadata: { conversationId: input.conversationId },
        }),
      );
      return {
        result: message,
        events: [
          applicationEvent(
            this.dependencies,
            "message.created",
            input.projectId,
            { messageId: message.id },
            input.conversationId,
          ),
        ],
      };
    });
  }
}

/** Adds an authorized agent-only internal note. */
export class AddInternalNote {
  public constructor(private readonly dependencies: ApplicationDependencies) {}

  public execute(input: AddInternalNoteInput): Promise<Message> {
    return transactional(this.dependencies, async (database) => {
      requirePermission(input.actor, "internal_note.create");
      await requireConversation(
        database,
        input.projectId,
        input.conversationId,
      );
      assertValidClientMessageId(input.clientMessageId);
      const duplicate = await existingMessage(database, input);
      if (duplicate) {
        if (
          duplicate.senderType !== "agent" ||
          duplicate.senderId !== input.actor.id ||
          duplicate.type !== "internal_note"
        ) {
          throw new DomainError(
            "CONFLICT",
            "Client message ID is already used by another message.",
          );
        }
        return { result: duplicate, events: [] };
      }
      const message = createMessage(this.dependencies, {
        ...input,
        type: "internal_note",
      });
      await database.messages.save(message);
      await database.audit.append(
        auditEvent(this.dependencies, {
          projectId: input.projectId,
          action: "internal_note.created",
          actor: input.actor,
          resourceId: message.id,
          resourceType: "message",
        }),
      );
      return {
        result: message,
        events: [
          applicationEvent(
            this.dependencies,
            "internal_note.created",
            input.projectId,
            { messageId: message.id },
            input.conversationId,
          ),
        ],
      };
    });
  }
}

/** Assigns a conversation while preserving prior assignment history. */
export class AssignConversation {
  public constructor(private readonly dependencies: ApplicationDependencies) {}

  public execute(
    input: AssignConversationInput,
  ): Promise<ConversationAssignment> {
    return transactional(this.dependencies, async (database) => {
      requirePermission(input.actor, "conversation.assign");
      requireValue(input.agentId, "agentId");
      await requireConversation(
        database,
        input.projectId,
        input.conversationId,
      );
      const target = await database.agents.findById({
        projectId: input.projectId,
        id: input.agentId,
      });
      if (!target)
        throw new DomainError("NOT_FOUND", "Assigned agent was not found.");
      const now = this.dependencies.clock.now();
      const current = await database.assignments.findActive(
        input.projectId,
        input.conversationId,
      );
      if (current?.agentId === input.agentId)
        return { result: current, events: [] };
      if (current)
        await database.assignments.save({
          ...current,
          unassignedAt: now,
          updatedAt: now,
        });
      const assignment: ConversationAssignment = {
        id: this.dependencies.ids.generate(),
        projectId: input.projectId,
        conversationId: input.conversationId,
        agentId: input.agentId,
        assignedByAgentId: input.actor.id,
        createdAt: now,
        updatedAt: now,
      };
      await database.assignments.save(assignment);
      await database.audit.append(
        auditEvent(this.dependencies, {
          projectId: input.projectId,
          action: "conversation.assigned",
          actor: input.actor,
          resourceId: input.conversationId,
          resourceType: "conversation",
          metadata: { agentId: input.agentId },
        }),
      );
      return {
        result: assignment,
        events: [
          applicationEvent(
            this.dependencies,
            "conversation.assigned",
            input.projectId,
            { conversationId: input.conversationId, agentId: input.agentId },
            input.conversationId,
          ),
        ],
      };
    });
  }
}

function statusPermission(
  status: Conversation["status"],
): Parameters<typeof requirePermission>[1] {
  if (status === "open") return "conversation.reopen";
  if (status === "spam") return "conversation.mark_spam";
  return "conversation.close";
}

/** Changes conversation state under lifecycle and permission rules. */
export class ChangeConversationStatus {
  public constructor(private readonly dependencies: ApplicationDependencies) {}

  public execute(input: ChangeConversationStatusInput): Promise<Conversation> {
    return transactional(this.dependencies, async (database) => {
      requirePermission(input.actor, statusPermission(input.status));
      const conversation = await requireConversation(
        database,
        input.projectId,
        input.conversationId,
      );
      assertConversationTransition(conversation.status, input.status);
      const updated: Conversation = {
        ...conversation,
        status: input.status,
        updatedAt: this.dependencies.clock.now(),
      };
      await database.conversations.save(updated);
      await database.audit.append(
        auditEvent(this.dependencies, {
          projectId: input.projectId,
          action: "conversation.status_changed",
          actor: input.actor,
          resourceId: input.conversationId,
          resourceType: "conversation",
          metadata: { from: conversation.status, to: input.status },
        }),
      );
      return {
        result: updated,
        events: [
          applicationEvent(
            this.dependencies,
            "conversation.status_changed",
            input.projectId,
            {
              conversationId: input.conversationId,
              previousStatus: conversation.status,
              status: input.status,
              actorId: input.actor.id,
            },
            input.conversationId,
          ),
        ],
      };
    });
  }
}

/** Reopens a terminal conversation. */
export class ReopenConversation {
  public constructor(private readonly dependencies: ApplicationDependencies) {}
  public execute(input: ReopenConversationInput): Promise<Conversation> {
    return new ChangeConversationStatus(this.dependencies).execute({
      ...input,
      status: "open",
    });
  }
}

/** Marks a conversation as spam. */
export class MarkConversationAsSpam {
  public constructor(private readonly dependencies: ApplicationDependencies) {}
  public execute(input: MarkConversationAsSpamInput): Promise<Conversation> {
    return new ChangeConversationStatus(this.dependencies).execute({
      ...input,
      status: "spam",
    });
  }
}

/** Records an idempotent project-scoped read receipt. */
export class RecordMessageRead {
  public constructor(private readonly dependencies: ApplicationDependencies) {}

  public execute(
    input: RecordMessageReadInput,
  ): Promise<RecordMessageReadResult> {
    return transactional<RecordMessageReadResult>(
      this.dependencies,
      async (database) => {
        requireValue(input.projectId, "projectId");
        requireValue(input.messageId, "messageId");
        const message = await database.messages.findById({
          projectId: input.projectId,
          id: input.messageId,
        });
        if (!message)
          throw new DomainError("NOT_FOUND", "Message was not found.");
        if (message.type === "internal_note") {
          if (input.actor.type !== "agent") {
            throw new DomainError("NOT_FOUND", "Message was not found.");
          }
          requirePermission(input.actor, "internal_note.read");
        }
        await requireConversationAccess(
          database,
          input.projectId,
          message.conversationId,
          input.actor,
          "conversation.read",
        );
        const existing = await database.messageReceipts.findByMessageAndReader(
          input.projectId,
          message.id,
          input.actor.type,
          input.actor.id,
        );
        if (existing)
          return { result: { receipt: existing, created: false }, events: [] };
        const now = this.dependencies.clock.now();
        const receipt: MessageReceipt = {
          id: this.dependencies.ids.generate(),
          projectId: input.projectId,
          messageId: message.id,
          conversationId: message.conversationId,
          readerType: input.actor.type,
          readerId: input.actor.id,
          readAt: now,
          createdAt: now,
          updatedAt: now,
        };
        await database.messageReceipts.create(receipt);
        return {
          result: { receipt, created: true },
          events: [
            applicationEvent(
              this.dependencies,
              "message.read",
              input.projectId,
              {
                messageId: message.id,
                readerId: input.actor.id,
                readerType: input.actor.type,
              },
              message.conversationId,
            ),
          ],
        };
      },
    );
  }
}

/** Creates or updates a host-backed customer. */
export class UpsertCustomer {
  public constructor(private readonly dependencies: ApplicationDependencies) {}
  public execute(input: UpsertCustomerInput): Promise<Customer> {
    return transactional(this.dependencies, async (database) => {
      requireValue(input.projectId, "projectId");
      requireValue(input.externalCustomerId, "externalCustomerId");
      const existing = await database.customers.findByExternalId(
        input.projectId,
        input.externalCustomerId,
      );
      const now = this.dependencies.clock.now();
      const customer: Customer = {
        id: existing?.id ?? this.dependencies.ids.generate(),
        projectId: input.projectId,
        externalCustomerId: input.externalCustomerId,
        ...(input.name ? { name: input.name } : {}),
        ...(input.email ? { email: input.email } : {}),
        metadata: input.metadata ?? {},
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await database.customers.save(customer);
      return {
        result: customer,
        events: [
          applicationEvent(
            this.dependencies,
            "customer.updated",
            input.projectId,
            {
              customerId: customer.id,
            },
          ),
        ],
      };
    });
  }
}

/** Creates or updates a host-backed agent without role inference. */
export class UpsertAgent {
  public constructor(private readonly dependencies: ApplicationDependencies) {}
  public execute(input: UpsertAgentInput): Promise<Agent> {
    return transactional(this.dependencies, async (database) => {
      requireValue(input.projectId, "projectId");
      requireValue(input.externalAgentId, "externalAgentId");
      requireValue(input.name, "name");
      const existing = await database.agents.findByExternalId(
        input.projectId,
        input.externalAgentId,
      );
      const now = this.dependencies.clock.now();
      const agent: Agent = {
        id: existing?.id ?? this.dependencies.ids.generate(),
        projectId: input.projectId,
        externalAgentId: input.externalAgentId,
        name: input.name,
        ...(input.email ? { email: input.email } : {}),
        role: input.role,
        permissions: input.permissions,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await database.agents.save(agent);
      return {
        result: agent,
        events: [
          applicationEvent(
            this.dependencies,
            "agent.updated",
            input.projectId,
            { agentId: agent.id },
          ),
        ],
      };
    });
  }
}

/** Creates or refreshes a verified project-scoped visitor identity. */
export class UpsertVisitor {
  public constructor(private readonly dependencies: ApplicationDependencies) {}

  public execute(input: UpsertVisitorInput): Promise<AnonymousVisitor> {
    return transactional(this.dependencies, async (database) => {
      requireValue(input.projectId, "projectId");
      requireValue(input.externalVisitorId, "externalVisitorId");
      const existing = await database.visitors.findByExternalId(
        input.projectId,
        input.externalVisitorId,
      );
      const now = this.dependencies.clock.now();
      const visitor: AnonymousVisitor = {
        id: existing?.id ?? this.dependencies.ids.generate(),
        projectId: input.projectId,
        externalVisitorId: input.externalVisitorId,
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        ...(input.name ? { name: input.name } : {}),
        ...(input.email ? { email: input.email } : {}),
        metadata: input.metadata ?? {},
        lastSeenAt: now,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await database.visitors.save(visitor);
      return { result: visitor, events: [] };
    });
  }
}

/** Lists only conversations owned by the customer or visitor actor. */
export class ListCustomerConversations {
  public constructor(private readonly dependencies: ApplicationDependencies) {}
  public execute(
    input: ListCustomerConversationsInput,
  ): Promise<readonly Conversation[]> {
    return safely(async () => {
      requireValue(input.projectId, "projectId");
      requireValue(input.actor.id, "actor.id");
      return this.dependencies.database.conversations.listByParticipant(
        input.projectId,
        input.actor.type,
        input.actor.id,
      );
    });
  }
}

/** Lists a project-scoped inbox for an explicitly authorized agent. */
export class ListAgentInbox {
  public constructor(private readonly dependencies: ApplicationDependencies) {}
  public execute(input: ListAgentInboxInput): Promise<readonly Conversation[]> {
    return safely(async () => {
      requireValue(input.projectId, "projectId");
      requireValue(input.actor.id, "actor.id");
      requirePermission(input.actor, "conversation.read");
      return this.dependencies.database.conversations.listInbox(
        input.projectId,
        input.assignedToAgentId,
      );
    });
  }
}

/** Lists only messages visible to the requesting actor. */
export class ListConversationMessages {
  public constructor(private readonly dependencies: ApplicationDependencies) {}
  public execute(
    input: ListConversationMessagesInput,
  ): Promise<readonly Message[]> {
    return safely(async () => {
      await requireConversationAccess(
        this.dependencies.database,
        input.projectId,
        input.conversationId,
        input.actor,
        "conversation.read",
      );
      const messages =
        await this.dependencies.database.messages.listByConversation(
          input.projectId,
          input.conversationId,
        );
      if (input.actor.type !== "agent")
        return messages.filter(isCustomerVisibleMessage);
      return input.actor.permissions.includes("internal_note.read")
        ? messages
        : messages.filter(isCustomerVisibleMessage);
    });
  }
}

async function changeTag(
  dependencies: ApplicationDependencies,
  input: ConversationTagInput,
  operation: "add" | "remove",
): Promise<void> {
  return transactional(dependencies, async (database) => {
    requireValue(input.tagId, "tagId");
    requirePermission(input.actor, "conversation.assign");
    await requireConversation(database, input.projectId, input.conversationId);
    const tag = await database.tags.findById({
      projectId: input.projectId,
      id: input.tagId,
    });
    if (!tag) throw new DomainError("NOT_FOUND", "Tag was not found.");
    await database.conversationTags[operation](
      input.projectId,
      input.conversationId,
      input.tagId,
    );
    const eventType =
      operation === "add"
        ? "conversation.tag_added"
        : "conversation.tag_removed";
    return {
      result: undefined,
      events: [
        applicationEvent(
          dependencies,
          eventType,
          input.projectId,
          { conversationId: input.conversationId, tagId: input.tagId },
          input.conversationId,
        ),
      ],
    };
  });
}

/** Adds a tag to a conversation. */
export class AddConversationTag {
  public constructor(private readonly dependencies: ApplicationDependencies) {}
  public execute(input: ConversationTagInput): Promise<void> {
    return changeTag(this.dependencies, input, "add");
  }
}

/** Removes a tag from a conversation. */
export class RemoveConversationTag {
  public constructor(private readonly dependencies: ApplicationDependencies) {}
  public execute(input: ConversationTagInput): Promise<void> {
    return changeTag(this.dependencies, input, "remove");
  }
}
