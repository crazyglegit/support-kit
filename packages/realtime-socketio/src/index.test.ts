import { createServer, type Server as HttpServer } from "node:http";
import type {
  SupportCommittedEvent,
  SupportKit,
  SupportKitErrorCode,
} from "@crazyglegit/support";
import { SupportKitError } from "@crazyglegit/support";
import { Server } from "socket.io";
import {
  io as createClient,
  type Socket as ClientSocket,
} from "socket.io-client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupportSocketServer,
  type SupportSocketAcknowledgement,
} from "./index.js";

const ORIGIN = "https://app.example.test";
const PROJECT_ID = "00000000-0000-4000-8000-000000000001";
const CONVERSATION_A = "00000000-0000-4000-8000-000000000101";
const CONVERSATION_B = "00000000-0000-4000-8000-000000000102";
const NOW = new Date("2026-08-01T00:00:00.000Z");

interface Harness {
  readonly http: HttpServer;
  readonly io: Server;
  readonly realtime: ReturnType<typeof createSupportSocketServer>;
  readonly support: SupportKit;
  readonly url: string;
  readonly messages: Map<string, ReturnType<typeof storedMessage>>;
  persistenceFails: boolean;
  persistedBeforeEvent: boolean;
}

const harnesses: Harness[] = [];
const clients: ClientSocket[] = [];

function actorCredentials(context: { readonly data?: unknown }) {
  if (
    typeof context.data !== "object" ||
    context.data === null ||
    !("auth" in context.data)
  )
    return {};
  const auth = context.data.auth;
  return typeof auth === "object" && auth !== null
    ? (auth as Readonly<Record<string, unknown>>)
    : {};
}

function storedMessage(input: {
  id: string;
  conversationId: string;
  senderType: "customer" | "visitor" | "agent";
  senderId: string;
  body: string;
  clientMessageId: string;
  type?: "text" | "internal_note";
}) {
  return {
    id: input.id,
    projectId: PROJECT_ID,
    conversationId: input.conversationId,
    senderType: input.senderType,
    senderId: input.senderId,
    body: input.body,
    clientMessageId: input.clientMessageId,
    type: input.type ?? ("text" as const),
    deliveryStatus: "pending" as const,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function supportError(code: SupportKitErrorCode, message: string): never {
  throw new SupportKitError(code, message);
}

async function createHarness(input?: {
  authDelayMs?: number;
  allowedOrigins?: readonly string[];
  typingTtlMs?: number;
  eventRateLimit?: () => boolean;
}): Promise<Harness> {
  const listeners = new Set<
    (event: SupportCommittedEvent) => void | Promise<void>
  >();
  const messages = new Map<string, ReturnType<typeof storedMessage>>();
  const messageByClientId = new Map<string, ReturnType<typeof storedMessage>>();
  const receipts = new Set<string>();
  const owners = new Map([
    [CONVERSATION_A, new Set(["customer-a", "visitor-a"])],
    [CONVERSATION_B, new Set(["customer-b"])],
  ]);
  let sequence = 0;
  const state = { persistenceFails: false, persistedBeforeEvent: false };
  const publish = async (
    eventType: string,
    conversationId: string,
    data: Readonly<Record<string, unknown>>,
  ) => {
    state.persistedBeforeEvent = true;
    const event: SupportCommittedEvent = {
      eventId: `event-${String(++sequence)}`,
      eventType,
      conversationId,
      occurredAt: NOW.toISOString(),
      data,
    };
    await Promise.all(
      [...listeners].map((listener) => Promise.resolve(listener(event))),
    );
  };
  const credentials = async (
    context: { readonly data?: unknown },
    expected: "customer" | "visitor" | "agent",
  ) => {
    if (input?.authDelayMs)
      await new Promise((resolveDelay) =>
        setTimeout(resolveDelay, input.authDelayMs),
      );
    const credentials = actorCredentials(context);
    if (credentials.verified !== true || credentials.actorType !== expected)
      return supportError("UNAUTHENTICATED", "Authentication failed.");
    const id = typeof credentials.id === "string" ? credentials.id : "missing";
    return { id, limited: credentials.limited === true };
  };
  const assertAccess = (
    actor: { type: string; id: string },
    conversationId: string,
  ) => {
    if (!owners.has(conversationId))
      return supportError("NOT_FOUND", "Conversation was not found.");
    if (actor.type !== "agent" && !owners.get(conversationId)?.has(actor.id))
      return supportError("NOT_FOUND", "Conversation was not found.");
  };
  const support: SupportKit = {
    projectId: PROJECT_ID,
    auth: {
      resolveCustomer: async (context) => ({
        type: "customer",
        id: (await credentials(context, "customer")).id,
      }),
      resolveVisitor: async (context) => ({
        type: "visitor",
        id: (await credentials(context, "visitor")).id,
      }),
      resolveAgent: async (context) => {
        const identity = await credentials(context, "agent");
        return {
          type: "agent",
          id: identity.id,
          role: "support_agent",
          permissions: identity.limited
            ? (["conversation.read"] as const)
            : ([
                "conversation.read",
                "conversation.reply",
                "conversation.assign",
                "conversation.close",
                "conversation.reopen",
                "conversation.mark_spam",
                "internal_note.create",
                "internal_note.read",
              ] as const),
        };
      },
    },
    conversations: {
      create: () =>
        Promise.resolve(supportError("FEATURE_UNAVAILABLE", "Not used.")),
      listForCustomer: () => Promise.resolve([]),
      listInbox: () => Promise.resolve([]),
      sendMessage: async (request) => {
        assertAccess(request.actor, request.conversationId);
        if (state.persistenceFails)
          return supportError("INTERNAL_ERROR", "Persistence failed.");
        const key = `${request.conversationId}:${request.clientMessageId}`;
        const duplicate = messageByClientId.get(key);
        if (duplicate) return duplicate;
        const message = storedMessage({
          id: `message-${String(++sequence)}`,
          conversationId: request.conversationId,
          senderType: request.actor.type,
          senderId: request.actor.id,
          body: request.body,
          clientMessageId: request.clientMessageId,
        });
        messages.set(message.id, message);
        messageByClientId.set(key, message);
        await publish("message.created", request.conversationId, {
          messageId: message.id,
        });
        return message;
      },
      addInternalNote: async (request) => {
        if (!request.actor.permissions.includes("internal_note.create"))
          return supportError("FORBIDDEN", "Permission denied.");
        const key = `${request.conversationId}:${request.clientMessageId}`;
        const duplicate = messageByClientId.get(key);
        if (duplicate) return duplicate;
        const message = storedMessage({
          id: `note-${String(++sequence)}`,
          conversationId: request.conversationId,
          senderType: "agent",
          senderId: request.actor.id,
          body: request.body,
          clientMessageId: request.clientMessageId,
          type: "internal_note",
        });
        messages.set(message.id, message);
        messageByClientId.set(key, message);
        await publish("internal_note.created", request.conversationId, {
          messageId: message.id,
        });
        return message;
      },
      assign: async (request) => {
        if (!request.actor.permissions.includes("conversation.assign"))
          return supportError("FORBIDDEN", "Permission denied.");
        await publish("conversation.assigned", request.conversationId, {
          conversationId: request.conversationId,
          agentId: request.agentId,
        });
        return {
          id: `assignment-${String(sequence)}`,
          projectId: PROJECT_ID,
          conversationId: request.conversationId,
          agentId: request.agentId,
          assignedByAgentId: request.actor.id,
          createdAt: NOW,
          updatedAt: NOW,
        };
      },
      changeStatus: async (request) => {
        await publish("conversation.status_changed", request.conversationId, {
          conversationId: request.conversationId,
          status: request.status,
        });
        return {
          id: request.conversationId,
          projectId: PROJECT_ID,
          status: request.status,
          createdAt: NOW,
          updatedAt: NOW,
        };
      },
      reopen: async (request) =>
        support.conversations.changeStatus({ ...request, status: "open" }),
      markSpam: async (request) =>
        support.conversations.changeStatus({ ...request, status: "spam" }),
    },
    messages: {
      list: (request) => {
        assertAccess(request.actor, request.conversationId);
        return Promise.resolve(
          [...messages.values()].filter(
            (message) =>
              message.conversationId === request.conversationId &&
              (request.actor.type === "agent" ||
                message.type !== "internal_note"),
          ),
        );
      },
      recordRead: async (request) => {
        const message = messages.get(request.messageId);
        if (!message)
          return supportError("NOT_FOUND", "Message was not found.");
        assertAccess(request.actor, message.conversationId);
        const key = `${message.id}:${request.actor.type}:${request.actor.id}`;
        const created = !receipts.has(key);
        receipts.add(key);
        if (created)
          await publish("message.read", message.conversationId, {
            messageId: message.id,
          });
        return {
          created,
          receipt: {
            id: `receipt:${key}`,
            projectId: PROJECT_ID,
            messageId: message.id,
            conversationId: message.conversationId,
            readerType: request.actor.type,
            readerId: request.actor.id,
            readAt: NOW,
            createdAt: NOW,
            updatedAt: NOW,
          },
        };
      },
    },
    tags: {
      add: async (request) =>
        publish("conversation.tag_added", request.conversationId, {
          conversationId: request.conversationId,
          tagId: request.tagId,
        }),
      remove: async (request) =>
        publish("conversation.tag_removed", request.conversationId, {
          conversationId: request.conversationId,
          tagId: request.tagId,
        }),
    },
    attachments: {
      createUploadIntent: () =>
        Promise.resolve(supportError("FEATURE_UNAVAILABLE", "Not used.")),
      completeUpload: () =>
        Promise.resolve(supportError("FEATURE_UNAVAILABLE", "Not used.")),
      deletePending: () => Promise.resolve(),
      getDownload: () =>
        Promise.resolve(supportError("FEATURE_UNAVAILABLE", "Not used.")),
    },
    customers: {
      upsert: () =>
        Promise.resolve(supportError("FEATURE_UNAVAILABLE", "Not used.")),
    },
    agents: {
      upsert: () =>
        Promise.resolve(supportError("FEATURE_UNAVAILABLE", "Not used.")),
    },
    events: {
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    healthCheck: () =>
      Promise.resolve({
        status: "healthy",
        projectId: PROJECT_ID,
        checks: {
          initialization: { status: "healthy" },
          project: { status: "healthy" },
          database: { status: "healthy" },
          auth: { status: "healthy" },
          realtime: { status: "disabled" },
          storage: { status: "disabled" },
          notifications: { status: "disabled" },
          ai: { status: "disabled" },
        },
      }),
    dispose: () => Promise.resolve(),
  };
  const http = createServer();
  const io = new Server(http, {
    transports: ["websocket"],
    maxHttpBufferSize: 1024 * 1024,
  });
  await new Promise<void>((resolveListen) =>
    http.listen(0, "127.0.0.1", resolveListen),
  );
  const address = http.address();
  if (!address || typeof address === "string")
    throw new Error("Server did not bind.");
  const realtime = createSupportSocketServer({
    io,
    support,
    options: {
      allowedOrigins: input?.allowedOrigins ?? [ORIGIN],
      authenticationTimeoutMs: 20,
      typingTtlMs: input?.typingTtlMs ?? 30,
      typingThrottleMs: 20,
      ...(input?.eventRateLimit
        ? { eventRateLimit: input.eventRateLimit }
        : {}),
    },
  });
  const harness: Harness = {
    http,
    io,
    realtime,
    support,
    messages,
    url: `http://127.0.0.1:${String(address.port)}`,
    get persistenceFails() {
      return state.persistenceFails;
    },
    set persistenceFails(value: boolean) {
      state.persistenceFails = value;
    },
    get persistedBeforeEvent() {
      return state.persistedBeforeEvent;
    },
    set persistedBeforeEvent(value: boolean) {
      state.persistedBeforeEvent = value;
    },
  };
  harnesses.push(harness);
  return harness;
}

function connect(
  harness: Harness,
  actorType: "customer" | "visitor" | "agent",
  id: string,
  options?: { origin?: string; verified?: boolean; limited?: boolean },
) {
  const client = createClient(harness.url, {
    transports: ["websocket"],
    extraHeaders: { Origin: options?.origin ?? ORIGIN },
    auth: {
      actorType,
      id,
      verified: options?.verified ?? true,
      limited: options?.limited ?? false,
    },
    reconnection: false,
    forceNew: true,
  });
  clients.push(client);
  return client;
}

function connected(client: ClientSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    client.once("connect", resolve);
    client.once("connect_error", reject);
  });
}

function acknowledged<T>(
  client: ClientSocket,
  event: string,
  payload: unknown,
): Promise<SupportSocketAcknowledgement<T>> {
  return new Promise((resolve) => client.emit(event, payload, resolve));
}

function event(
  client: ClientSocket,
  name: string,
): Promise<Readonly<Record<string, unknown>>> {
  return new Promise((resolve) => client.once(name, resolve));
}

afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  for (const harness of harnesses.splice(0)) {
    await harness.realtime.dispose();
    await harness.io.close();
  }
});

describe("Socket.IO realtime adapter", () => {
  it.each([
    ["customer", "customer-a"],
    ["visitor", "visitor-a"],
    ["agent", "agent-a"],
  ] as const)("authenticates a verified %s", async (actorType, id) => {
    const harness = await createHarness();
    const client = connect(harness, actorType, id);
    await connected(client);
    expect(client.connected).toBe(true);
    expect((await harness.realtime.healthCheck()).connections).toBe(1);
  });

  it("rejects invalid auth, invalid origins, and authentication timeouts safely", async () => {
    const harness = await createHarness({ authDelayMs: 40 });
    const timeoutClient = connect(harness, "customer", "customer-a");
    const timeout = await new Promise<Error & { data?: { code?: string } }>(
      (resolve) => timeoutClient.once("connect_error", resolve),
    );
    expect(timeout.data?.code).toBe("AUTHENTICATION_TIMEOUT");

    const invalidOrigin = connect(harness, "customer", "customer-a", {
      origin: "https://evil.example",
    });
    const originError = await new Promise<Error & { data?: { code?: string } }>(
      (resolve) => invalidOrigin.once("connect_error", resolve),
    );
    expect(originError.data?.code).toBe("ORIGIN_NOT_ALLOWED");

    const invalidAuthHarness = await createHarness();
    const invalidAuth = connect(invalidAuthHarness, "customer", "customer-a", {
      verified: false,
    });
    const authError = await new Promise<Error>((resolve) =>
      invalidAuth.once("connect_error", resolve),
    );
    expect(authError.message).not.toContain("stack");
  });

  it("authorizes joins and blocks other customers and arbitrary room input", async () => {
    const harness = await createHarness();
    const customer = connect(harness, "customer", "customer-a");
    await connected(customer);
    expect(
      await acknowledged(customer, "conversation.join", {
        conversationId: CONVERSATION_A,
      }),
    ).toMatchObject({ ok: true });
    expect(
      await acknowledged(customer, "conversation.join", {
        conversationId: CONVERSATION_B,
      }),
    ).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(
      await acknowledged(customer, "conversation.join", {
        conversationId: CONVERSATION_A,
        room: "project:other:agents",
      }),
    ).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("persists messages before one broadcast, handles retry idempotently, receipts, and failures", async () => {
    const harness = await createHarness();
    const customer = connect(harness, "customer", "customer-a");
    const agent = connect(harness, "agent", "agent-a");
    await Promise.all([connected(customer), connected(agent)]);
    await acknowledged(customer, "conversation.join", {
      conversationId: CONVERSATION_A,
    });
    await acknowledged(agent, "conversation.join", {
      conversationId: CONVERSATION_A,
    });
    const created = event(agent, "message.created");
    const first = await acknowledged<{
      created: boolean;
      message: { id: string };
    }>(customer, "message.send", {
      conversationId: CONVERSATION_A,
      body: "hello",
      clientMessageId: "client-message-0001",
    });
    expect(first).toMatchObject({ ok: true, data: { created: true } });
    expect(await created).toMatchObject({ data: { body: "hello" } });
    expect(harness.persistedBeforeEvent).toBe(true);
    const duplicateEvent = vi.fn();
    agent.once("message.created", duplicateEvent);
    const retry = await acknowledged<{ created: boolean }>(
      customer,
      "message.send",
      {
        conversationId: CONVERSATION_A,
        body: "hello",
        clientMessageId: "client-message-0001",
      },
    );
    expect(retry).toMatchObject({ ok: true, data: { created: false } });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(duplicateEvent).not.toHaveBeenCalled();
    expect(harness.messages.size).toBe(1);

    if (!first.ok) throw new Error("Expected message success.");
    const messageId = first.data.message.id;
    expect(
      await acknowledged(customer, "message.read", { messageId }),
    ).toMatchObject({ ok: true, data: { created: true } });
    expect(
      await acknowledged(customer, "message.read", { messageId }),
    ).toMatchObject({ ok: true, data: { created: false } });
    expect(
      await acknowledged(agent, "message.read", { messageId }),
    ).toMatchObject({ ok: true, data: { created: true } });

    const customerReply = event(customer, "message.created");
    expect(
      await acknowledged(agent, "message.send", {
        conversationId: CONVERSATION_A,
        body: "agent reply",
        clientMessageId: "agent-message-0001",
      }),
    ).toMatchObject({ ok: true, data: { created: true } });
    expect(await customerReply).toMatchObject({
      data: { body: "agent reply", senderType: "agent" },
    });

    harness.persistenceFails = true;
    const noBroadcast = vi.fn();
    agent.once("message.created", noBroadcast);
    expect(
      await acknowledged(customer, "message.send", {
        conversationId: CONVERSATION_A,
        body: "fail",
        clientMessageId: "client-message-0002",
      }),
    ).toMatchObject({ ok: false, error: { code: "INTERNAL_ERROR" } });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(noBroadcast).not.toHaveBeenCalled();
  });

  it("isolates internal notes and enforces agent permissions", async () => {
    const harness = await createHarness();
    const customer = connect(harness, "customer", "customer-a");
    const visitor = connect(harness, "visitor", "visitor-a");
    const agent = connect(harness, "agent", "agent-a");
    const limited = connect(harness, "agent", "agent-limited", {
      limited: true,
    });
    await Promise.all([
      connected(customer),
      connected(visitor),
      connected(agent),
      connected(limited),
    ]);
    for (const client of [customer, visitor, agent, limited])
      await acknowledged(client, "conversation.join", {
        conversationId: CONVERSATION_A,
      });
    const customerLeak = vi.fn();
    const visitorLeak = vi.fn();
    customer.on("internal_note.created", customerLeak);
    visitor.on("internal_note.created", visitorLeak);
    const noteEvent = event(agent, "internal_note.created");
    expect(
      await acknowledged(agent, "internal_note.create", {
        conversationId: CONVERSATION_A,
        body: "secret",
        clientMessageId: "internal-note-0001",
      }),
    ).toMatchObject({ ok: true });
    expect(await noteEvent).toMatchObject({
      data: { body: "secret", type: "internal_note" },
    });
    expect(
      await acknowledged(limited, "internal_note.create", {
        conversationId: CONVERSATION_A,
        body: "denied",
        clientMessageId: "internal-note-0002",
      }),
    ).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(customerLeak).not.toHaveBeenCalled();
    expect(visitorLeak).not.toHaveBeenCalled();
  });

  it("validates agent mutations, typing expiry, rate limits, and disposal", async () => {
    const harness = await createHarness({ typingTtlMs: 20 });
    const customer = connect(harness, "customer", "customer-a");
    const agent = connect(harness, "agent", "agent-a");
    await Promise.all([connected(customer), connected(agent)]);
    await acknowledged(customer, "conversation.join", {
      conversationId: CONVERSATION_A,
    });
    await acknowledged(agent, "conversation.join", {
      conversationId: CONVERSATION_A,
    });
    expect(
      await acknowledged(customer, "conversation.assign", {
        conversationId: CONVERSATION_A,
        agentId: "agent-a",
      }),
    ).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(
      await acknowledged(agent, "conversation.status.change", {
        conversationId: CONVERSATION_A,
        status: "invalid",
      }),
    ).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(
      await acknowledged(agent, "conversation.assign", {
        conversationId: CONVERSATION_A,
        agentId: "agent-a",
      }),
    ).toMatchObject({ ok: true });
    expect(
      await acknowledged(agent, "conversation.status.change", {
        conversationId: CONVERSATION_A,
        status: "resolved",
      }),
    ).toMatchObject({ ok: true });
    expect(
      await acknowledged(agent, "conversation.reopen", {
        conversationId: CONVERSATION_A,
      }),
    ).toMatchObject({ ok: true });
    expect(
      await acknowledged(agent, "conversation.spam", {
        conversationId: CONVERSATION_A,
      }),
    ).toMatchObject({ ok: true });
    expect(
      await acknowledged(agent, "conversation.tag.add", {
        conversationId: CONVERSATION_A,
        tagId: "tag-a",
      }),
    ).toMatchObject({ ok: true });
    expect(
      await acknowledged(agent, "conversation.tag.remove", {
        conversationId: CONVERSATION_A,
        tagId: "tag-a",
      }),
    ).toMatchObject({ ok: true });
    const typingStart = event(agent, "typing.updated");
    await acknowledged(customer, "typing.start", {
      conversationId: CONVERSATION_A,
    });
    expect(await typingStart).toMatchObject({
      data: { active: true, actor: { id: "customer-a" } },
    });
    const typingStop = event(agent, "typing.updated");
    expect(await typingStop).toMatchObject({ data: { active: false } });
    await harness.realtime.dispose();
    await harness.realtime.dispose();
    expect(await harness.realtime.healthCheck()).toMatchObject({
      status: "unhealthy",
      disposed: true,
      connections: 0,
    });
  });

  it("rejects oversized and rate-limited events", async () => {
    const harness = await createHarness({ eventRateLimit: () => false });
    const customer = connect(harness, "customer", "customer-a");
    await connected(customer);
    expect(
      await acknowledged(customer, "conversation.join", {
        conversationId: CONVERSATION_A,
      }),
    ).toMatchObject({ ok: false, error: { code: "RATE_LIMITED" } });

    const normal = await createHarness();
    const client = connect(normal, "customer", "customer-a");
    await connected(client);
    expect(
      await acknowledged(client, "message.send", {
        conversationId: CONVERSATION_A,
        body: "x".repeat(70_000),
        clientMessageId: "oversized-message-01",
      }),
    ).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
  });
});
