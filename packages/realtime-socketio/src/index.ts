import type {
  SupportCommittedEvent,
  SupportKit,
  SupportKitErrorCode,
} from "@crazyglegit/support";
import { isSupportKitError } from "@crazyglegit/support";
import {
  conversationAssignSchema,
  conversationJoinSchema,
  conversationLeaveSchema,
  conversationStatusChangeSchema,
  conversationTagSchema,
  internalNoteCreateSchema,
  messageReadSchema,
  messageSendSchema,
  typingSchema,
  type SupportSocketAcknowledgement,
  type SupportSocketEventEnvelope,
} from "@crazyglegit/support-contracts";
import type { Server, Socket } from "socket.io";
import type { z } from "zod";

type CustomerActor = Awaited<ReturnType<SupportKit["auth"]["resolveCustomer"]>>;
type VisitorActor = Awaited<ReturnType<SupportKit["auth"]["resolveVisitor"]>>;
type AgentActor = Awaited<ReturnType<SupportKit["auth"]["resolveAgent"]>>;
type VerifiedActor = CustomerActor | VisitorActor | AgentActor;
type Acknowledge<T = unknown> = (
  result: SupportSocketAcknowledgement<T>,
) => void;

export interface SupportSocketConnectionRateLimitInput {
  readonly origin: string;
  readonly address: string;
}

export interface SupportSocketEventRateLimitInput {
  readonly event: SupportSocketClientEventName;
  readonly actor: Readonly<{ type: VerifiedActor["type"]; id: string }>;
}

export interface SupportSocketServerOptions {
  readonly allowedOrigins: readonly string[];
  readonly authenticationTimeoutMs?: number;
  readonly maxPayloadBytes?: number;
  readonly typingThrottleMs?: number;
  readonly typingTtlMs?: number;
  readonly connectionRateLimit?: (
    input: SupportSocketConnectionRateLimitInput,
  ) => boolean | Promise<boolean>;
  readonly eventRateLimit?: (
    input: SupportSocketEventRateLimitInput,
  ) => boolean | Promise<boolean>;
  readonly now?: () => Date;
  readonly createId?: () => string;
}

export type SupportSocketClientEventName =
  | "conversation.join"
  | "conversation.leave"
  | "message.send"
  | "message.read"
  | "typing.start"
  | "typing.stop"
  | "conversation.assign"
  | "conversation.status.change"
  | "conversation.reopen"
  | "conversation.spam"
  | "internal_note.create"
  | "conversation.tag.add"
  | "conversation.tag.remove";

export interface SupportSocketClientEvents {
  readonly event: SupportSocketClientEventName;
}

export interface SupportSocketServerEvents {
  readonly event:
    | "message.created"
    | "message.read"
    | "conversation.updated"
    | "conversation.assigned"
    | "conversation.status_changed"
    | "internal_note.created"
    | "conversation.tag_added"
    | "conversation.tag_removed"
    | "typing.updated"
    | "presence.updated"
    | "support.error";
}

export interface SupportSocketHealth {
  readonly status: "healthy" | "unhealthy";
  readonly attached: boolean;
  readonly disposed: boolean;
  readonly connections: number;
}

export interface SupportSocketServer {
  attach(): void;
  healthCheck(): Promise<SupportSocketHealth>;
  dispose(): Promise<void>;
}

interface SocketContext {
  actor?: VerifiedActor;
  typing: Set<string>;
}

interface TypingEntry {
  readonly socket: Socket;
  readonly actor: VerifiedActor;
  readonly conversationId: string;
  timer: ReturnType<typeof setTimeout>;
  lastEmittedAt: number;
}

const DEFAULTS = {
  authenticationTimeoutMs: 5_000,
  maxPayloadBytes: 64 * 1024,
  typingThrottleMs: 750,
  typingTtlMs: 8_000,
} as const;

function publicMessage(
  message: Awaited<ReturnType<SupportKit["conversations"]["sendMessage"]>>,
) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    clientMessageId: message.clientMessageId,
    type: message.type,
    senderType: message.senderType,
    senderId: message.senderId,
    body: message.body,
    deliveryStatus: message.deliveryStatus,
    attachments: (message.attachments ?? []).map((attachment) => ({
      id: attachment.id,
      fileName: attachment.safeDisplayFilename,
      mediaType: attachment.detectedMimeType ?? attachment.claimedMimeType,
      sizeBytes: attachment.sizeBytes,
      status: "ready" as const,
    })),
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}

function publicConversation(
  conversation: Awaited<
    ReturnType<SupportKit["conversations"]["changeStatus"]>
  >,
) {
  return {
    id: conversation.id,
    status: conversation.status,
    subject: conversation.subject,
    priority: conversation.priority,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

class SocketServerImplementation implements SupportSocketServer {
  readonly #io: Server;
  readonly #support: SupportKit;
  readonly #options: Required<
    Pick<
      SupportSocketServerOptions,
      | "authenticationTimeoutMs"
      | "maxPayloadBytes"
      | "typingThrottleMs"
      | "typingTtlMs"
      | "now"
      | "createId"
    >
  > &
    SupportSocketServerOptions;
  readonly #contexts = new Map<string, SocketContext>();
  readonly #sockets = new Set<Socket>();
  readonly #typing = new Map<string, TypingEntry>();
  readonly #recentResources = new Map<string, number>();
  readonly #committedResources = new Map<string, number>();
  readonly #eventIds = new Set<string>();
  #commitSequence = 0;
  #unsubscribe: (() => void) | undefined;
  #attached = false;
  #disposed = false;

  public constructor(
    io: Server,
    support: SupportKit,
    options: SupportSocketServerOptions,
  ) {
    this.#io = io;
    this.#support = support;
    this.#options = {
      ...options,
      authenticationTimeoutMs:
        options.authenticationTimeoutMs ?? DEFAULTS.authenticationTimeoutMs,
      maxPayloadBytes: options.maxPayloadBytes ?? DEFAULTS.maxPayloadBytes,
      typingThrottleMs: options.typingThrottleMs ?? DEFAULTS.typingThrottleMs,
      typingTtlMs: options.typingTtlMs ?? DEFAULTS.typingTtlMs,
      now: options.now ?? (() => new Date()),
      createId: options.createId ?? (() => globalThis.crypto.randomUUID()),
    };
    if (options.allowedOrigins.length === 0)
      throw new Error("At least one exact allowed origin is required.");
  }

  public attach(): void {
    if (this.#disposed) throw new Error("The realtime adapter is disposed.");
    if (this.#attached) return;
    this.#attached = true;
    this.#io.use((socket, next) => {
      void this.authenticate(socket, next);
    });
    this.#io.on("connection", this.onConnection);
    this.#unsubscribe = this.#support.events.subscribe(this.onCommittedEvent);
  }

  private readonly authenticate = async (
    socket: Socket,
    next: (error?: Error) => void,
  ): Promise<void> => {
    try {
      // Socket.IO does not expose middleware removal. A disposed adapter becomes
      // an inert pass-through so a later adapter on the same host server can attach.
      if (this.#disposed) {
        next();
        return;
      }
      const origin = socket.handshake.headers.origin;
      if (!origin || !this.#options.allowedOrigins.includes(origin))
        throw this.connectionError("ORIGIN_NOT_ALLOWED");
      if (
        this.#options.connectionRateLimit &&
        !(await this.#options.connectionRateLimit({
          origin,
          address: socket.handshake.address,
        }))
      )
        throw this.connectionError("RATE_LIMITED");
      const resolution = this.resolveActor(socket);
      const actor = await this.withTimeout(resolution);
      this.#contexts.set(socket.id, { actor, typing: new Set() });
      next();
    } catch (error) {
      next(
        error instanceof Error
          ? error
          : this.connectionError("UNAUTHENTICATED"),
      );
    }
  };

  private async resolveActor(socket: Socket): Promise<VerifiedActor> {
    const auth = socket.handshake.auth as Readonly<Record<string, unknown>>;
    const actorType = auth.actorType;
    const headers = Object.fromEntries(
      Object.entries(socket.handshake.headers).flatMap(([key, value]) =>
        typeof value === "string" ? [[key, value]] : [],
      ),
    );
    const context = {
      method: "SOCKET",
      url: socket.handshake.url,
      headers,
      data: { auth, query: socket.handshake.query },
    };
    if (actorType === "agent") return this.#support.auth.resolveAgent(context);
    if (actorType === "customer")
      return this.#support.auth.resolveCustomer(context);
    if (actorType === "visitor")
      return this.#support.auth.resolveVisitor(context);
    throw this.connectionError("UNAUTHENTICATED");
  }

  private async withTimeout<T>(operation: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            reject(this.connectionError("AUTHENTICATION_TIMEOUT"));
          }, this.#options.authenticationTimeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private connectionError(code: string): Error {
    const error = new Error("The realtime connection was rejected.");
    Object.assign(error, { data: { code } });
    return error;
  }

  private readonly onConnection = (socket: Socket): void => {
    const context = this.#contexts.get(socket.id);
    if (!context?.actor) {
      socket.disconnect(true);
      return;
    }
    this.#sockets.add(socket);
    const actor = context.actor;
    void socket.join(this.actorRoom(actor));
    if (
      actor.type === "agent" &&
      actor.permissions.includes("conversation.read")
    )
      void socket.join(this.agentProjectRoom());
    this.emitToSocket(socket, "presence.updated", {
      actor: { type: actor.type, id: actor.id },
      status: "connected",
      lastActivityAt: this.#options.now().toISOString(),
    });

    this.register(
      socket,
      "conversation.join",
      conversationJoinSchema,
      async (input) => {
        await this.authorizeConversation(actor, input.conversationId);
        await socket.join(this.conversationRoom(input.conversationId));
        if (
          actor.type === "agent" &&
          actor.permissions.includes("internal_note.read")
        )
          await socket.join(
            this.internalConversationRoom(input.conversationId),
          );
        return { conversationId: input.conversationId };
      },
    );
    this.register(
      socket,
      "conversation.leave",
      conversationLeaveSchema,
      async (input) => {
        await socket.leave(this.conversationRoom(input.conversationId));
        await socket.leave(this.internalConversationRoom(input.conversationId));
        this.clearTyping(socket, input.conversationId, true);
        return { conversationId: input.conversationId };
      },
    );
    this.register(socket, "message.send", messageSendSchema, async (input) => {
      await this.authorizeConversation(actor, input.conversationId);
      const beforeCommit = this.#commitSequence;
      const message = await this.#support.conversations.sendMessage({
        actor,
        conversationId: input.conversationId,
        body: input.body,
        clientMessageId: input.clientMessageId,
        ...(input.attachmentIds ? { attachmentIds: input.attachmentIds } : {}),
      });
      const resource = `message.created:${message.id}`;
      const created = this.wasCommittedAfter(resource, beforeCommit);
      this.markResource(resource);
      if (created)
        this.emitToRoom(
          this.conversationRoom(input.conversationId),
          "message.created",
          publicMessage(message),
          input.conversationId,
        );
      return { message: publicMessage(message), created };
    });
    this.register(socket, "message.read", messageReadSchema, async (input) => {
      const result = await this.#support.messages.recordRead({
        actor,
        messageId: input.messageId,
      });
      if (result.created) {
        this.markResource(`message.read:${result.receipt.messageId}`);
        this.emitToRoom(
          this.conversationRoom(result.receipt.conversationId),
          "message.read",
          {
            messageId: result.receipt.messageId,
            readerType: result.receipt.readerType,
            readerId: result.receipt.readerId,
            readAt: result.receipt.readAt.toISOString(),
          },
          result.receipt.conversationId,
        );
      }
      return { created: result.created };
    });
    this.register(socket, "typing.start", typingSchema, async (input) => {
      await this.authorizeConversation(actor, input.conversationId);
      this.startTyping(socket, actor, input.conversationId);
      return { conversationId: input.conversationId };
    });
    this.register(socket, "typing.stop", typingSchema, (input) => {
      this.clearTyping(socket, input.conversationId, true);
      return Promise.resolve({ conversationId: input.conversationId });
    });
    this.registerAgent(
      socket,
      actor,
      "conversation.assign",
      conversationAssignSchema,
      async (agent, input) => {
        const beforeCommit = this.#commitSequence;
        const assignment = await this.#support.conversations.assign({
          ...input,
          actor: agent,
        });
        const resource = `conversation.assigned:${assignment.conversationId}`;
        const created = this.wasCommittedAfter(resource, beforeCommit);
        this.markResource(resource);
        if (created) {
          this.emitToRoom(
            this.agentProjectRoom(),
            "conversation.assigned",
            {
              conversationId: assignment.conversationId,
              agentId: assignment.agentId,
              assignedAt: assignment.createdAt.toISOString(),
            },
            assignment.conversationId,
          );
          this.emitToRoom(
            this.conversationRoom(assignment.conversationId),
            "conversation.updated",
            {
              conversationId: assignment.conversationId,
              updatedAt: assignment.updatedAt.toISOString(),
            },
            assignment.conversationId,
          );
        }
        return {
          conversationId: assignment.conversationId,
          agentId: assignment.agentId,
          created,
        };
      },
    );
    this.registerAgent(
      socket,
      actor,
      "conversation.status.change",
      conversationStatusChangeSchema,
      async (agent, input) =>
        this.changeStatus(input.conversationId, () =>
          this.#support.conversations.changeStatus({ ...input, actor: agent }),
        ),
    );
    this.registerAgent(
      socket,
      actor,
      "conversation.reopen",
      conversationJoinSchema,
      async (agent, input) =>
        this.changeStatus(input.conversationId, () =>
          this.#support.conversations.reopen({ ...input, actor: agent }),
        ),
    );
    this.registerAgent(
      socket,
      actor,
      "conversation.spam",
      conversationJoinSchema,
      async (agent, input) =>
        this.changeStatus(input.conversationId, () =>
          this.#support.conversations.markSpam({ ...input, actor: agent }),
        ),
    );
    this.registerAgent(
      socket,
      actor,
      "internal_note.create",
      internalNoteCreateSchema,
      async (agent, input) => {
        const beforeCommit = this.#commitSequence;
        const message = await this.#support.conversations.addInternalNote({
          conversationId: input.conversationId,
          body: input.body,
          clientMessageId: input.clientMessageId,
          ...(input.attachmentIds
            ? { attachmentIds: input.attachmentIds }
            : {}),
          actor: agent,
        });
        const resource = `internal_note.created:${message.id}`;
        const created = this.wasCommittedAfter(resource, beforeCommit);
        this.markResource(resource);
        if (created)
          this.emitToRoom(
            this.internalConversationRoom(input.conversationId),
            "internal_note.created",
            publicMessage(message),
            input.conversationId,
          );
        return { message: publicMessage(message), created };
      },
    );
    this.registerAgent(
      socket,
      actor,
      "conversation.tag.add",
      conversationTagSchema,
      async (agent, input) => {
        await this.#support.tags.add({ ...input, actor: agent });
        this.markResource(`conversation.tag_added:${input.conversationId}`);
        this.emitToRoom(
          this.agentProjectRoom(),
          "conversation.tag_added",
          { conversationId: input.conversationId, tagId: input.tagId },
          input.conversationId,
        );
        return { conversationId: input.conversationId, tagId: input.tagId };
      },
    );
    this.registerAgent(
      socket,
      actor,
      "conversation.tag.remove",
      conversationTagSchema,
      async (agent, input) => {
        await this.#support.tags.remove({ ...input, actor: agent });
        this.markResource(`conversation.tag_removed:${input.conversationId}`);
        this.emitToRoom(
          this.agentProjectRoom(),
          "conversation.tag_removed",
          { conversationId: input.conversationId, tagId: input.tagId },
          input.conversationId,
        );
        return { conversationId: input.conversationId, tagId: input.tagId };
      },
    );
    socket.on("disconnect", () => {
      this.onDisconnect(socket);
    });
  };

  private register<TSchema extends z.ZodType, TResult>(
    socket: Socket,
    event: SupportSocketClientEventName,
    schema: TSchema,
    operation: (input: z.output<TSchema>) => Promise<TResult>,
  ): void {
    socket.on(event, (payload: unknown, ack?: Acknowledge<TResult>) => {
      void this.handle(socket, event, schema, payload, ack, operation);
    });
  }

  private registerAgent<TSchema extends z.ZodType, TResult>(
    socket: Socket,
    actor: VerifiedActor,
    event: SupportSocketClientEventName,
    schema: TSchema,
    operation: (
      actor: AgentActor,
      input: z.output<TSchema>,
    ) => Promise<TResult>,
  ): void {
    this.register(socket, event, schema, async (input) => {
      if (actor.type !== "agent")
        throw this.safeError("FORBIDDEN", "This operation requires an agent.");
      return operation(actor, input);
    });
  }

  private async handle<TSchema extends z.ZodType, TResult>(
    socket: Socket,
    event: SupportSocketClientEventName,
    schema: TSchema,
    payload: unknown,
    ack: Acknowledge<TResult> | undefined,
    operation: (input: z.output<TSchema>) => Promise<TResult>,
  ): Promise<void> {
    const requestId = this.requestId(payload);
    try {
      if (this.#disposed)
        throw this.safeError("SDK_DISPOSED", "Realtime is unavailable.");
      if (this.payloadBytes(payload) > this.#options.maxPayloadBytes)
        throw this.safeError(
          "VALIDATION_ERROR",
          "The event payload is too large.",
        );
      const context = this.#contexts.get(socket.id);
      if (!context?.actor)
        throw this.safeError("UNAUTHENTICATED", "Authentication is required.");
      if (
        this.#options.eventRateLimit &&
        !(await this.#options.eventRateLimit({
          event,
          actor: { type: context.actor.type, id: context.actor.id },
        }))
      )
        throw this.safeError("RATE_LIMITED", "Too many realtime events.");
      const parsed = schema.safeParse(payload);
      if (!parsed.success)
        throw this.safeError(
          "VALIDATION_ERROR",
          "The event payload is invalid.",
        );
      const data = await operation(parsed.data);
      ack?.({ ok: true, data, requestId });
    } catch (error) {
      const safe = this.toSafeError(error, requestId);
      ack?.({ ok: false, error: safe });
      this.emitToSocket(socket, "support.error", safe);
    }
  }

  private async authorizeConversation(
    actor: VerifiedActor,
    conversationId: string,
  ): Promise<void> {
    await this.#support.messages.list({ actor, conversationId });
  }

  private async changeStatus(
    conversationId: string,
    operation: () => ReturnType<SupportKit["conversations"]["changeStatus"]>,
  ) {
    const conversation = await operation();
    this.markResource(`conversation.status_changed:${conversation.id}`);
    const data = publicConversation(conversation);
    this.emitToRoom(
      this.conversationRoom(conversationId),
      "conversation.status_changed",
      data,
      conversationId,
    );
    return { conversation: data };
  }

  private startTyping(
    socket: Socket,
    actor: VerifiedActor,
    conversationId: string,
  ): void {
    const key = `${socket.id}:${conversationId}`;
    const existing = this.#typing.get(key);
    const now = this.#options.now().getTime();
    if (existing) {
      clearTimeout(existing.timer);
      existing.timer = setTimeout(() => {
        this.clearTyping(socket, conversationId, true);
      }, this.#options.typingTtlMs);
      if (now - existing.lastEmittedAt < this.#options.typingThrottleMs) return;
      existing.lastEmittedAt = now;
    } else {
      const entry: TypingEntry = {
        socket,
        actor,
        conversationId,
        lastEmittedAt: now,
        timer: setTimeout(() => {
          this.clearTyping(socket, conversationId, true);
        }, this.#options.typingTtlMs),
      };
      this.#typing.set(key, entry);
      this.#contexts.get(socket.id)?.typing.add(conversationId);
    }
    this.emitTyping(actor, conversationId, true, socket.id);
  }

  private clearTyping(
    socket: Socket,
    conversationId: string,
    emit: boolean,
  ): void {
    const key = `${socket.id}:${conversationId}`;
    const entry = this.#typing.get(key);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.#typing.delete(key);
    this.#contexts.get(socket.id)?.typing.delete(conversationId);
    if (emit) this.emitTyping(entry.actor, conversationId, false, socket.id);
  }

  private emitTyping(
    actor: VerifiedActor,
    conversationId: string,
    active: boolean,
    exceptSocketId: string,
  ): void {
    this.emitToRoom(
      this.conversationRoom(conversationId),
      "typing.updated",
      {
        actor: { type: actor.type, id: actor.id },
        active,
        expiresAt: active
          ? new Date(
              this.#options.now().getTime() + this.#options.typingTtlMs,
            ).toISOString()
          : undefined,
      },
      conversationId,
      exceptSocketId,
    );
  }

  private onDisconnect(socket: Socket): void {
    const context = this.#contexts.get(socket.id);
    if (context?.actor) {
      for (const conversationId of [...context.typing])
        this.clearTyping(socket, conversationId, true);
      this.emitToRoom(this.actorRoom(context.actor), "presence.updated", {
        actor: { type: context.actor.type, id: context.actor.id },
        status: "disconnected",
        lastActivityAt: this.#options.now().toISOString(),
      });
    }
    this.#contexts.delete(socket.id);
    this.#sockets.delete(socket);
  }

  private readonly onCommittedEvent = (event: SupportCommittedEvent): void => {
    if (this.#disposed || this.#eventIds.has(event.eventId)) return;
    this.#eventIds.add(event.eventId);
    const resource = this.eventResource(event);
    if (resource)
      this.#committedResources.set(resource, ++this.#commitSequence);
    if (this.#eventIds.size > 10_000)
      this.#eventIds.delete(this.#eventIds.values().next().value ?? "");
    setTimeout(() => {
      this.broadcastCommittedEvent(event);
    }, 0);
  };

  private broadcastCommittedEvent(event: SupportCommittedEvent): void {
    if (this.#disposed || !event.conversationId) return;
    const resourceId =
      typeof event.data.messageId === "string"
        ? event.data.messageId
        : typeof event.data.conversationId === "string"
          ? event.data.conversationId
          : undefined;
    const resource = resourceId
      ? `${event.eventType}:${resourceId}`
      : undefined;
    if (resource && this.wasRecentlyEmitted(resource)) return;
    const publicTypes = new Set([
      "message.created",
      "message.read",
      "conversation.status_changed",
    ]);
    const agentTypes = new Set([
      "conversation.assigned",
      "conversation.tag_added",
      "conversation.tag_removed",
    ]);
    if (event.eventType === "internal_note.created")
      this.emitEnvelope(this.internalConversationRoom(event.conversationId), {
        eventId: event.eventId,
        eventType: "internal_note.created",
        version: 1,
        conversationId: event.conversationId,
        occurredAt: event.occurredAt,
        data: event.data,
      });
    else if (publicTypes.has(event.eventType))
      this.emitEnvelope(this.conversationRoom(event.conversationId), {
        eventId: event.eventId,
        eventType:
          event.eventType === "conversation.status_changed"
            ? "conversation.status_changed"
            : event.eventType,
        version: 1,
        conversationId: event.conversationId,
        occurredAt: event.occurredAt,
        data: event.data,
      } as SupportSocketEventEnvelope);
    else if (agentTypes.has(event.eventType))
      this.emitEnvelope(this.agentProjectRoom(), {
        eventId: event.eventId,
        eventType: event.eventType,
        version: 1,
        conversationId: event.conversationId,
        occurredAt: event.occurredAt,
        data: event.data,
      } as SupportSocketEventEnvelope);
  }

  private eventResource(event: SupportCommittedEvent): string | undefined {
    const resourceId =
      typeof event.data.messageId === "string"
        ? event.data.messageId
        : typeof event.data.conversationId === "string"
          ? event.data.conversationId
          : undefined;
    return resourceId ? `${event.eventType}:${resourceId}` : undefined;
  }

  private wasCommittedAfter(resource: string, sequence: number): boolean {
    return (this.#committedResources.get(resource) ?? 0) > sequence;
  }

  private emitToRoom(
    room: string,
    eventType: SupportSocketEventEnvelope["eventType"],
    data: unknown,
    conversationId?: string,
    exceptSocketId?: string,
  ): void {
    const envelope: SupportSocketEventEnvelope = {
      eventId: this.#options.createId(),
      eventType,
      version: 1,
      ...(conversationId ? { conversationId } : {}),
      occurredAt: this.#options.now().toISOString(),
      data,
    };
    const target = exceptSocketId
      ? this.#io.to(room).except(exceptSocketId)
      : this.#io.to(room);
    target.emit(eventType, envelope);
  }

  private emitEnvelope(
    room: string,
    envelope: SupportSocketEventEnvelope,
  ): void {
    this.#io.to(room).emit(envelope.eventType, envelope);
  }

  private emitToSocket(
    socket: Socket,
    eventType: SupportSocketEventEnvelope["eventType"],
    data: unknown,
  ): void {
    const envelope: SupportSocketEventEnvelope = {
      eventId: this.#options.createId(),
      eventType,
      version: 1,
      occurredAt: this.#options.now().toISOString(),
      data,
    };
    socket.emit(eventType, envelope);
  }

  private payloadBytes(payload: unknown): number {
    try {
      return new TextEncoder().encode(JSON.stringify(payload)).byteLength;
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  }

  private requestId(payload: unknown): string {
    if (
      typeof payload === "object" &&
      payload !== null &&
      "requestId" in payload &&
      typeof payload.requestId === "string" &&
      payload.requestId.length <= 255
    )
      return payload.requestId;
    return this.#options.createId();
  }

  private safeError(
    code: SupportKitErrorCode | "RATE_LIMITED",
    message: string,
  ): Error {
    return Object.assign(new Error(message), { code });
  }

  private toSafeError(error: unknown, requestId: string) {
    if (isSupportKitError(error))
      return { code: error.code, message: error.message, requestId };
    if (
      error instanceof Error &&
      "code" in error &&
      typeof error.code === "string"
    )
      return { code: error.code, message: error.message, requestId };
    return {
      code: "INTERNAL_ERROR",
      message: "The realtime operation failed.",
      requestId,
    };
  }

  private markResource(resource: string): void {
    this.#recentResources.set(resource, this.#options.now().getTime());
    if (this.#recentResources.size > 10_000)
      this.#recentResources.delete(
        this.#recentResources.keys().next().value ?? "",
      );
  }

  private wasRecentlyEmitted(resource: string): boolean {
    const timestamp = this.#recentResources.get(resource);
    return (
      timestamp !== undefined &&
      this.#options.now().getTime() - timestamp < 60_000
    );
  }

  private projectPrefix(): string {
    return `project:${this.#support.projectId}`;
  }
  private conversationRoom(id: string): string {
    return `${this.projectPrefix()}:conversation:${id}`;
  }
  private internalConversationRoom(id: string): string {
    return `${this.projectPrefix()}:conversation:${id}:agents`;
  }
  private agentProjectRoom(): string {
    return `${this.projectPrefix()}:agents`;
  }
  private actorRoom(actor: VerifiedActor): string {
    return `${this.projectPrefix()}:${actor.type}:${actor.id}`;
  }

  public async healthCheck(): Promise<SupportSocketHealth> {
    const sdk = await this.#support.healthCheck().catch(() => undefined);
    return {
      status:
        !this.#disposed && sdk?.status !== "unhealthy"
          ? "healthy"
          : "unhealthy",
      attached: this.#attached,
      disposed: this.#disposed,
      connections: this.#sockets.size,
    };
  }

  public dispose(): Promise<void> {
    if (this.#disposed) return Promise.resolve();
    this.#disposed = true;
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#io.off("connection", this.onConnection);
    for (const entry of this.#typing.values()) clearTimeout(entry.timer);
    this.#typing.clear();
    for (const socket of this.#sockets) {
      socket.removeAllListeners();
      socket.disconnect(true);
    }
    this.#sockets.clear();
    this.#contexts.clear();
    this.#recentResources.clear();
    this.#committedResources.clear();
    this.#eventIds.clear();
    return Promise.resolve();
  }
}

/** Creates and attaches one project-scoped Socket.IO realtime transport. */
export function createSupportSocketServer(input: {
  readonly io: Server;
  readonly support: SupportKit;
  readonly options: SupportSocketServerOptions;
}): SupportSocketServer {
  const server = new SocketServerImplementation(
    input.io,
    input.support,
    input.options,
  );
  server.attach();
  return server;
}

export type {
  SupportSocketAcknowledgement,
  SupportSocketEventEnvelope,
} from "@crazyglegit/support-contracts";
