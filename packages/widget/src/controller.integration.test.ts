// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface FakeSocket {
  connected: boolean;
  readonly auth: unknown;
  readonly emitted: { event: string; args: unknown[] }[];
  readonly listeners: Map<string, Set<(value?: unknown) => void>>;
  readonly disconnect: ReturnType<typeof vi.fn>;
  readonly removeAllListeners: ReturnType<typeof vi.fn>;
  on(event: string, listener: (value?: unknown) => void): FakeSocket;
  emit(event: string, ...args: unknown[]): FakeSocket;
  trigger(event: string, value?: unknown): void;
}

const sockets = vi.hoisted(() => ({ instances: [] as FakeSocket[] }));

vi.mock("socket.io-client", () => ({
  io: vi.fn((_url: string, options: { auth?: unknown }) => {
    const listeners = new Map<string, Set<(value?: unknown) => void>>();
    const socket: FakeSocket = {
      connected: true,
      auth: options.auth,
      emitted: [],
      listeners,
      disconnect: vi.fn(),
      removeAllListeners: vi.fn(() => {
        listeners.clear();
      }),
      on(event, listener) {
        const set = listeners.get(event) ?? new Set();
        set.add(listener);
        listeners.set(event, set);
        return socket;
      },
      emit(event, ...args) {
        socket.emitted.push({ event, args });
        const acknowledgement = args.at(-1);
        if (typeof acknowledgement === "function") {
          const acknowledge = acknowledgement as (value: unknown) => void;
          acknowledge({ ok: true, data: {}, requestId: "request-1" });
        }
        return socket;
      },
      trigger(event, value) {
        for (const listener of listeners.get(event) ?? []) listener(value);
      },
    };
    sockets.instances.push(socket);
    return socket;
  }),
}));

import { createSupportWidget } from "./controller.js";

const timestamp = "2026-01-01T00:00:00.000Z";
const conversation = {
  id: "conversation-1",
  status: "open",
  createdAt: timestamp,
  updatedAt: timestamp,
} as const;
const baseMessage = {
  id: "message-1",
  conversationId: conversation.id,
  clientMessageId: "client-message-0001",
  type: "text",
  senderType: "agent",
  body: "Existing reply",
  deliveryStatus: "delivered",
  createdAt: timestamp,
  updatedAt: timestamp,
} as const;

let actorType: "customer" | "visitor";
let conversations: readonly unknown[];
let messages: readonly unknown[];
let serverConfig: Readonly<Record<string, unknown>>;
let customFetch:
  | ((path: string, init?: RequestInit) => Promise<Response> | Response)
  | undefined;
let requests: { path: string; init?: RequestInit }[];

function success(data: unknown, status = 200): Response {
  return Response.json({ success: true, data }, { status });
}
function failure(code: string, message: string, status: number): Response {
  return Response.json(
    { success: false, error: { code, message, requestId: "request-1" } },
    { status },
  );
}
function requestBody(init?: RequestInit): string {
  if (typeof init?.body !== "string")
    throw new Error("Expected a string request body.");
  return init.body;
}
async function settle(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}
function root(): ShadowRoot {
  const value = document.querySelector<HTMLElement>(
    "[data-support-widget]",
  )?.shadowRoot;
  if (!value) throw new Error("Widget root was not created.");
  return value;
}
async function openConversation(): Promise<void> {
  root().querySelector<HTMLButtonElement>('[data-action="list"]')?.click();
  root()
    .querySelector<HTMLButtonElement>('[data-action="conversation"]')
    ?.click();
  await settle();
}

beforeEach(() => {
  sockets.instances.length = 0;
  actorType = "visitor";
  conversations = [];
  messages = [];
  serverConfig = { features: { attachments: false, chatbot: false } };
  customFetch = undefined;
  requests = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.pathname
            : new URL(input.url).pathname;
      requests.push({ path, ...(init ? { init } : {}) });
      if (customFetch) return customFetch(path, init);
      if (path.endsWith("/widget/config")) return success(serverConfig);
      if (path.endsWith("/session"))
        return success({ actor: { type: actorType, id: "server-only-id" } });
      if (path.endsWith("/conversations")) return success(conversations);
      if (path.endsWith(`/conversations/${conversation.id}`))
        return success({ conversation });
      if (path.endsWith(`/conversations/${conversation.id}/messages`))
        return success(messages);
      if (path.includes("/read")) return success({ created: true });
      throw new Error(`Unhandled test request: ${path}`);
    }),
  );
});

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe.each(["customer", "visitor"] as const)(
  "%s session initialization",
  (kind) => {
    it("resolves the verified session before private data and socket bootstrap", async () => {
      actorType = kind;
      const widget = createSupportWidget({ socketUrl: "https://socket.test" });
      await settle();
      expect(requests.map(({ path }) => path)).toEqual([
        "/api/support/widget/config",
        "/api/support/session",
        "/api/support/conversations",
      ]);
      expect(sockets.instances).toHaveLength(1);
      expect(sockets.instances[0]?.auth).toEqual({ actorType: kind });
      widget.destroy();
    });
  },
);

describe("durable and realtime reconciliation", () => {
  it("prevents double submission and retries conversation creation with one clientMessageId", async () => {
    let createCount = 0;
    const bodies: unknown[] = [];
    customFetch = (path, init) => {
      if (path.endsWith("/widget/config")) return success(serverConfig);
      if (path.endsWith("/session"))
        return success({ actor: { type: actorType } });
      if (path.endsWith("/conversations") && init?.method !== "POST")
        return success([]);
      if (path.endsWith("/conversations") && init?.method === "POST") {
        createCount++;
        bodies.push(JSON.parse(requestBody(init)) as unknown);
        if (createCount === 1)
          return failure("INTERNAL_ERROR", "Unable to create.", 500);
        return success(
          {
            conversation,
            initialMessage: {
              ...baseMessage,
              senderType: "visitor",
              body: "Need help",
              clientMessageId: (
                bodies[0] as { initialMessage: { clientMessageId: string } }
              ).initialMessage.clientMessageId,
            },
          },
          201,
        );
      }
      if (path.endsWith(`/conversations/${conversation.id}`))
        return success({ conversation });
      if (path.endsWith(`/conversations/${conversation.id}/messages`))
        return success([]);
      throw new Error(`Unhandled request ${path}`);
    };
    const widget = createSupportWidget();
    widget.open();
    await settle();
    root().querySelector<HTMLButtonElement>('[data-action="new"]')?.click();
    const textarea = root().querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Composer unavailable.");
    textarea.value = "Need help";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    const send = root().querySelector<HTMLButtonElement>(
      '[data-action="send"]',
    );
    send?.click();
    send?.click();
    await settle();
    expect(createCount).toBe(1);
    root().querySelector<HTMLButtonElement>('[data-action="retry"]')?.click();
    await settle();
    expect(createCount).toBe(2);
    expect(
      (bodies[0] as { initialMessage: { clientMessageId: string } })
        .initialMessage.clientMessageId,
    ).toMatch(/^[0-9a-f-]{36}$/);
    expect(
      (bodies[1] as { initialMessage: { clientMessageId: string } })
        .initialMessage.clientMessageId,
    ).toBe(
      (bodies[0] as { initialMessage: { clientMessageId: string } })
        .initialMessage.clientMessageId,
    );
    widget.destroy();
  });

  it("retries a failed send with the same clientMessageId and renders one message", async () => {
    conversations = [conversation];
    messages = [];
    const attempts: { body: string; clientMessageId: string }[] = [];
    customFetch = (path, init) => {
      if (path.endsWith("/widget/config")) return success(serverConfig);
      if (path.endsWith("/session"))
        return success({ actor: { type: actorType } });
      if (path.endsWith("/conversations")) return success(conversations);
      if (path.endsWith(`/conversations/${conversation.id}`))
        return success({ conversation });
      if (
        path.endsWith(`/conversations/${conversation.id}/messages`) &&
        init?.method !== "POST"
      )
        return success(messages);
      if (
        path.endsWith(`/conversations/${conversation.id}/messages`) &&
        init?.method === "POST"
      ) {
        const body = JSON.parse(requestBody(init)) as {
          body: string;
          clientMessageId: string;
        };
        attempts.push(body);
        if (attempts.length === 1)
          return failure("INTERNAL_ERROR", "Unable to send.", 500);
        return success({
          ...baseMessage,
          id: "message-sent",
          senderType: "visitor",
          body: body.body,
          clientMessageId: body.clientMessageId,
        });
      }
      throw new Error(`Unhandled request ${path}`);
    };
    const widget = createSupportWidget();
    widget.open();
    await settle();
    await openConversation();
    const textarea = root().querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Composer unavailable.");
    textarea.value = "Retry me";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    root().querySelector<HTMLButtonElement>('[data-action="send"]')?.click();
    await settle();
    root().querySelector<HTMLButtonElement>('[data-action="retry"]')?.click();
    await settle();
    expect(attempts).toHaveLength(2);
    expect(attempts[1]?.clientMessageId).toBe(attempts[0]?.clientMessageId);
    expect(
      [...root().querySelectorAll(".bubble")].filter((item) =>
        item.textContent.includes("Retry me"),
      ),
    ).toHaveLength(1);
    widget.destroy();
  });

  it("deduplicates realtime replies and performs HTTP resync after reconnect", async () => {
    conversations = [conversation];
    messages = [baseMessage];
    const received = vi.fn();
    const widget = createSupportWidget({ socketUrl: "https://socket.test" });
    widget.on("message.received", received);
    widget.open();
    await settle();
    await openConversation();
    const socket = sockets.instances[0];
    if (!socket) throw new Error("Socket unavailable.");
    const readsBefore = requests.filter(({ path }) =>
      path.endsWith("/read"),
    ).length;
    const reply = {
      ...baseMessage,
      id: "reply-a",
      clientMessageId: "agent-reply-client-1",
      body: "Realtime reply",
    };
    socket.trigger("message.created", {
      eventId: "event-1",
      eventType: "message.created",
      version: 1,
      conversationId: conversation.id,
      occurredAt: timestamp,
      data: reply,
    });
    socket.trigger("message.created", {
      eventId: "event-2",
      eventType: "message.created",
      version: 1,
      conversationId: conversation.id,
      occurredAt: timestamp,
      data: { ...reply, id: "reply-b" },
    });
    await settle();
    expect(
      [...root().querySelectorAll(".bubble")].filter((item) =>
        item.textContent.includes("Realtime reply"),
      ),
    ).toHaveLength(1);
    expect(
      root().querySelector('[role="log"][aria-live="polite"]'),
    ).not.toBeNull();
    expect(received).toHaveBeenCalledOnce();
    expect(requests.filter(({ path }) => path.endsWith("/read")).length).toBe(
      readsBefore + 1,
    );
    const historyBefore = requests.filter(({ path }) =>
      path.endsWith(`/conversations/${conversation.id}/messages`),
    ).length;
    socket.trigger("disconnect");
    socket.trigger("connect");
    await settle();
    const historyAfter = requests.filter(({ path }) =>
      path.endsWith(`/conversations/${conversation.id}/messages`),
    ).length;
    expect(historyAfter).toBeGreaterThan(historyBefore);
    expect(
      [...root().querySelectorAll(".bubble")].filter((item) =>
        item.textContent.includes("Existing reply"),
      ),
    ).toHaveLength(1);
    widget.destroy();
  });
});

describe("security, fallback, and lifecycle", () => {
  it("escapes hostile plain text and excludes notes from DOM and widget events", async () => {
    conversations = [conversation];
    messages = [
      {
        ...baseMessage,
        body: '<img src=x onerror="alert(1)"><script>bad()</script> https://evil.test',
      },
    ];
    const received = vi.fn();
    const widget = createSupportWidget({ socketUrl: "https://socket.test" });
    widget.on("message.received", received);
    widget.open();
    await settle();
    await openConversation();
    expect(root().querySelector("img,script")).toBeNull();
    expect(root().querySelector("a")).toBeNull();
    expect(root().textContent).toContain("<img src=x");
    sockets.instances[0]?.trigger("message.created", {
      eventId: "note-event",
      eventType: "message.created",
      version: 1,
      conversationId: conversation.id,
      occurredAt: timestamp,
      data: {
        ...baseMessage,
        id: "note-1",
        type: "internal_note",
        body: "PRIVATE NOTE",
      },
    });
    await settle();
    expect(root().textContent).not.toContain("PRIVATE NOTE");
    expect(received).not.toHaveBeenCalled();
    widget.destroy();
  });

  it("shows a safe expired-session state and never requests private data", async () => {
    customFetch = (path) => {
      if (path.endsWith("/widget/config")) return success(serverConfig);
      if (path.endsWith("/session"))
        return failure("UNAUTHENTICATED", "Your support session expired.", 401);
      throw new Error("Private data was requested after session failure.");
    };
    const widget = createSupportWidget();
    widget.open();
    await settle();
    expect(root().textContent).toContain("Your support session expired.");
    expect(requests.some(({ path }) => path.endsWith("/conversations"))).toBe(
      false,
    );
    widget.destroy();
  });

  it("keeps HTTP messaging enabled when realtime is unavailable", async () => {
    conversations = [conversation];
    const widget = createSupportWidget({ socketUrl: "https://socket.test" });
    widget.open();
    await settle();
    await openConversation();
    sockets.instances[0]?.trigger("connect_error");
    expect(root().textContent).toContain("Live updates unavailable");
    expect(
      root().querySelector<HTMLTextAreaElement>("textarea")?.disabled,
    ).toBe(false);
    widget.destroy();
  });

  it("restores durable history in a fresh controller after page-style teardown", async () => {
    conversations = [conversation];
    messages = [baseMessage];
    const first = createSupportWidget();
    first.open();
    await settle();
    await openConversation();
    expect(root().textContent).toContain("Existing reply");
    first.destroy();
    const second = createSupportWidget();
    second.open();
    await settle();
    await openConversation();
    expect(root().textContent).toContain("Existing reply");
    second.destroy();
  });

  it("keeps sockets and state isolated across widget instances", async () => {
    const first = createSupportWidget({ socketUrl: "https://socket.test" });
    const second = createSupportWidget({ socketUrl: "https://socket.test" });
    await settle();
    expect(sockets.instances).toHaveLength(2);
    first.open();
    expect(first.isOpen()).toBe(true);
    expect(second.isOpen()).toBe(false);
    first.destroy();
    expect(sockets.instances[0]?.disconnect).toHaveBeenCalledOnce();
    expect(sockets.instances[1]?.disconnect).not.toHaveBeenCalled();
    second.destroy();
  });

  it("applies server presentation values but preserves safe local overrides", async () => {
    serverConfig = {
      title: "Server title",
      greeting: "Server greeting",
      launcherLabel: "Server launcher",
      position: "bottom-left",
      theme: "dark",
      accentColor: "#112233",
      features: { attachments: false, chatbot: false },
    };
    const serverWidget = createSupportWidget();
    await settle();
    const serverHost = document.querySelector<HTMLElement>(
      "[data-support-widget]",
    );
    expect(serverHost?.dataset.theme).toBe("dark");
    expect(serverHost?.style.getPropertyValue("--sw-accent")).toBe("#112233");
    expect(serverHost?.shadowRoot?.querySelector(".root.left")).not.toBeNull();
    serverWidget.destroy();

    const localWidget = createSupportWidget({
      title: "Local title",
      greeting: "Local greeting",
      launcherLabel: "Local launcher",
      position: "bottom-right",
      theme: "light",
      accentColor: "#abcdef",
    });
    localWidget.open();
    await settle();
    const localHost = document.querySelector<HTMLElement>(
      "[data-support-widget]",
    );
    expect(localHost?.dataset.theme).toBe("light");
    expect(localHost?.style.getPropertyValue("--sw-accent")).toBe("#abcdef");
    expect(localHost?.shadowRoot?.textContent).toContain("Local title");
    expect(localHost?.shadowRoot?.textContent).toContain("Local greeting");
    localWidget.destroy();
  });

  it("disposes pending requests, socket listeners, typing timers, and document listeners idempotently", async () => {
    conversations = [conversation];
    const removeDocumentListener = vi.spyOn(document, "removeEventListener");
    const widget = createSupportWidget({ socketUrl: "https://socket.test" });
    widget.open();
    await settle();
    await openConversation();
    const textarea = root().querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Composer unavailable.");
    textarea.value = "typing";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    const socket = sockets.instances[0];
    expect(
      socket?.emitted.filter(({ event }) => event === "typing.start"),
    ).toHaveLength(1);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    expect(
      socket?.emitted.filter(({ event }) => event === "typing.start"),
    ).toHaveLength(1);
    widget.destroy();
    widget.destroy();
    expect(socket?.removeAllListeners).toHaveBeenCalledOnce();
    expect(socket?.disconnect).toHaveBeenCalledOnce();
    expect(removeDocumentListener).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function),
    );
    expect(document.querySelector("[data-support-widget]")).toBeNull();
    removeDocumentListener.mockRestore();
  });

  it("renders sanitized attachment cards and requests authorized downloads only on activation", async () => {
    conversations = [conversation];
    messages = [
      {
        ...baseMessage,
        body: "",
        attachments: [
          {
            id: "attachment-1",
            fileName: '<img src=x onerror="alert(1)">.txt',
            mediaType: "text/plain",
            sizeBytes: 4,
            status: "ready",
          },
        ],
      },
    ];
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    customFetch = (path) => {
      if (path.endsWith("/widget/config")) return success(serverConfig);
      if (path.endsWith("/session"))
        return success({ actor: { type: actorType, id: "server-only-id" } });
      if (path.endsWith("/conversations")) return success(conversations);
      if (path.endsWith(`/conversations/${conversation.id}`))
        return success({ conversation });
      if (path.endsWith(`/conversations/${conversation.id}/messages`))
        return success(messages);
      if (path.includes("/attachments/attachment-1/download?"))
        return success({
          url: "https://storage.test/download",
          expiresAt: "2026-08-02T00:02:00.000Z",
        });
      return success({});
    };
    const widget = createSupportWidget();
    widget.open();
    await settle();
    await openConversation();
    expect(root().querySelector("img")).toBeNull();
    expect(root().textContent).toContain("<img src=x");
    expect(requests.some(({ path }) => path.includes("/attachments/"))).toBe(
      false,
    );
    root()
      .querySelector<HTMLButtonElement>('[data-action="download"]')
      ?.click();
    await settle();
    expect(
      requests.some(({ path }) =>
        path.includes("/attachments/attachment-1/download?"),
      ),
    ).toBe(true);
    expect(click).toHaveBeenCalledOnce();
    widget.destroy();
    click.mockRestore();
  });
});
