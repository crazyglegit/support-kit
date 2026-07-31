import {
  DomainError,
  hasPermission,
  isDomainError,
} from "@crazyglegit/support-core";
import type {
  AuditEvent,
  Conversation,
  SupportDatabaseAdapter,
  SupportPermission,
} from "@crazyglegit/support-core";
import type { ApplicationEvent } from "./events.js";
import type {
  AgentActor,
  ApplicationDependencies,
  ConversationActor,
  CustomerActor,
} from "./types.js";

export function runtimeActorType(actor: unknown): unknown {
  return (actor as { readonly type?: unknown }).type;
}

/** Raises a validation error for an empty required identifier or string. */
export function requireValue(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new DomainError("VALIDATION_ERROR", `${field} is required.`);
  }
}

/** Converts unknown dependency failures into a sanitized error. */
export async function safely<TResult>(
  operation: () => Promise<TResult>,
): Promise<TResult> {
  try {
    return await operation();
  } catch (error) {
    if (isDomainError(error)) {
      throw error;
    }
    throw new DomainError(
      "INTERNAL_ERROR",
      "The support operation could not be completed.",
    );
  }
}

export function requirePermission(
  actor: AgentActor,
  permission: SupportPermission,
): void {
  const runtimePermissions = (
    actor as unknown as { readonly permissions?: unknown }
  ).permissions;
  if (
    runtimeActorType(actor) !== "agent" ||
    !Array.isArray(runtimePermissions)
  ) {
    throw new DomainError("FORBIDDEN", "An authenticated agent is required.");
  }
  requireValue(actor.id, "actor.id");
  if (!hasPermission(actor.permissions, permission)) {
    throw new DomainError(
      "FORBIDDEN",
      `Missing required permission: ${permission}.`,
    );
  }
}

/** Requires the internal agent actor to exist in the active project. */
export async function requireProjectAgent(
  database: SupportDatabaseAdapter,
  projectId: string,
  actor: AgentActor,
): Promise<void> {
  requireValue(projectId, "projectId");
  requireValue(actor.id, "actor.id");
  const agent = await database.agents.findById({ projectId, id: actor.id });
  if (!agent) throw new DomainError("NOT_FOUND", "Agent was not found.");
}

export async function requireConversation(
  database: SupportDatabaseAdapter,
  projectId: string,
  conversationId: string,
): Promise<Conversation> {
  requireValue(projectId, "projectId");
  requireValue(conversationId, "conversationId");
  const conversation = await database.conversations.findById({
    projectId,
    id: conversationId,
  });
  if (!conversation) {
    throw new DomainError("NOT_FOUND", "Conversation was not found.");
  }
  return conversation;
}

export async function requireOwnership(
  database: SupportDatabaseAdapter,
  projectId: string,
  conversationId: string,
  actor: CustomerActor,
): Promise<void> {
  const type = runtimeActorType(actor);
  if (type !== "customer" && type !== "visitor") {
    throw new DomainError(
      "FORBIDDEN",
      "A customer or visitor actor is required.",
    );
  }
  requireValue(actor.id, "actor.id");
  const participant = await database.participants.findParticipant(
    projectId,
    conversationId,
    actor.type,
    actor.id,
  );
  if (!participant) {
    throw new DomainError(
      "FORBIDDEN",
      "The conversation does not belong to this actor.",
    );
  }
}

export async function requireConversationAccess(
  database: SupportDatabaseAdapter,
  projectId: string,
  conversationId: string,
  actor: ConversationActor,
  agentPermission: SupportPermission,
): Promise<Conversation> {
  const conversation = await requireConversation(
    database,
    projectId,
    conversationId,
  );
  if (actor.type === "agent") {
    requirePermission(actor, agentPermission);
    await requireProjectAgent(database, projectId, actor);
  } else {
    await requireOwnership(database, projectId, conversationId, actor);
  }
  return conversation;
}

export function auditEvent(
  dependencies: ApplicationDependencies,
  input: {
    projectId: string;
    action: string;
    actor: ConversationActor;
    resourceId: string;
    resourceType: string;
    metadata?: Readonly<Record<string, unknown>>;
  },
): AuditEvent {
  const now = dependencies.clock.now();
  return {
    id: dependencies.ids.generate(),
    projectId: input.projectId,
    action: input.action,
    actorId: input.actor.id,
    actorType: input.actor.type,
    resourceId: input.resourceId,
    resourceType: input.resourceType,
    metadata: input.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  };
}

export function applicationEvent<TData>(
  dependencies: ApplicationDependencies,
  type: ApplicationEvent<TData>["type"],
  projectId: string,
  data: TData,
  conversationId?: string,
): ApplicationEvent<TData> {
  return {
    id: dependencies.ids.generate(),
    type,
    projectId,
    occurredAt: dependencies.clock.now(),
    data,
    ...(conversationId ? { conversationId } : {}),
  };
}

export async function publishEvents(
  dependencies: ApplicationDependencies,
  events: readonly ApplicationEvent[],
): Promise<void> {
  if (!dependencies.events) return;
  for (const event of events) await dependencies.events.publish(event);
}
