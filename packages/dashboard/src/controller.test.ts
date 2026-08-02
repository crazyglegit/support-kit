// @vitest-environment happy-dom
/* eslint-disable @typescript-eslint/no-base-to-string, @typescript-eslint/non-nullable-type-assertion-style, @typescript-eslint/no-confusing-void-expression */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { io } from "socket.io-client";

const socketHandlers = new Map<string, (value?: unknown) => void>();
const socket = {
  on: vi.fn((name: string, listener: (value?: unknown) => void) => {
    socketHandlers.set(name, listener);
  }),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  removeAllListeners: vi.fn(),
};
vi.mock("socket.io-client", () => ({ io: vi.fn(() => socket) }));
import { SupportDashboardController, mergeMessages } from "./controller.js";

const now = "2026-08-02T00:00:00.000Z";
const conversation = {
  id: "conversation-1",
  status: "open",
  subject: "Checkout problem",
  createdAt: now,
  updatedAt: now,
};
const message = {
  id: "message-1",
  conversationId: "conversation-1",
  clientMessageId: "client-id-0001",
  type: "text",
  senderType: "customer",
  body: "Need help",
  deliveryStatus: "sent",
  createdAt: now,
  updatedAt: now,
} as const;
function response(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(
      JSON.stringify(
        status < 400
          ? { success: true, data }
          : { success: false, error: data },
      ),
      { status, headers: { "content-type": "application/json" } },
    ),
  );
}
function media() {
  Object.defineProperty(globalThis, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

describe("dashboard controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketHandlers.clear();
    document.body.replaceChildren();
    Object.defineProperty(globalThis, "innerWidth", {
      configurable: true,
      value: 1024,
    });
    media();
  });
  it("reconciles durable and optimistic messages by id and clientMessageId", () => {
    const optimistic = {
      ...message,
      id: "pending",
      deliveryStatus: "pending" as const,
    };
    expect(mergeMessages([optimistic], [message])).toEqual([message]);
    expect(mergeMessages([message], [message])).toHaveLength(1);
  });
  it("initializes through verified session before inbox and renders permission-aware controls", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = String(input);
        calls.push(url);
        return url.endsWith("/agent/session")
          ? response({
              actor: {
                type: "agent",
                id: "agent-1",
                role: "support_agent",
                permissions: ["conversation.read", "conversation.reply"],
              },
            })
          : response([conversation]);
      }),
    );
    const target = document.createElement("div");
    const controller = new SupportDashboardController({
      target,
      socketUrl: "https://support.example.com",
    });
    await controller.initialize();
    expect(calls).toEqual([
      "/api/support/widget/config",
      "/api/support/agent/session",
      "/api/support/agent/conversations",
    ]);
    expect(target.textContent).toContain("Checkout problem");
    expect(target.textContent).not.toContain("Assign to me");
    expect(io).toHaveBeenCalledWith(
      "https://support.example.com",
      expect.objectContaining({ auth: { actorType: "agent" } }),
    );
    controller.destroy();
  });
  it("keeps conversation activation stable when realtime connects", async () => {
    Object.defineProperty(globalThis, "innerWidth", {
      configurable: true,
      value: 390,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith("/agent/session"))
          return response({
            actor: {
              type: "agent",
              id: "agent-1",
              role: "support_agent",
              permissions: ["conversation.read", "conversation.reply"],
            },
          });
        if (url.endsWith("/agent/conversations/conversation-1"))
          return response({ conversation, messages: [message] });
        if (url.endsWith("/agent/conversations"))
          return response([conversation]);
        return response({ features: { attachments: false, chatbot: false } });
      }),
    );
    const target = document.createElement("div");
    document.body.append(target);
    const controller = new SupportDashboardController({
      target,
      socketUrl: "https://support.example.com",
    });
    await controller.initialize();
    const conversationButton = target.querySelector<HTMLButtonElement>(
      '[data-conversation="conversation-1"]',
    );
    expect(conversationButton).not.toBeNull();
    conversationButton?.focus();
    socketHandlers.get("connect_error")?.();
    socketHandlers.get("connect")?.();
    expect(conversationButton?.isConnected).toBe(true);
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
    );
    await vi.waitFor(() => {
      expect(
        target.querySelector(".sk-dashboard")?.getAttribute("data-mobile-view"),
      ).toBe("conversation");
      const back = target.querySelector<HTMLButtonElement>(
        '[data-action="back"]',
      );
      expect(back).not.toBeNull();
      expect(document.activeElement).toBe(back);
    });
    controller.destroy();
  });
  it("shows authorized notes distinctly and keeps hostile content inert", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith("/agent/session"))
          return response({
            actor: {
              type: "agent",
              id: "agent-1",
              role: "support_agent",
              permissions: [
                "conversation.read",
                "conversation.reply",
                "internal_note.read",
                "internal_note.create",
              ],
            },
          });
        if (url.endsWith("/agent/conversations"))
          return response([conversation]);
        return response({
          conversation,
          messages: [
            message,
            {
              ...message,
              id: "note-1",
              clientMessageId: "note-id-0001",
              type: "internal_note",
              senderType: "agent",
              body: '<img src=x onerror="alert(1)"> private',
            },
          ],
        });
      }),
    );
    const target = document.createElement("div");
    const controller = new SupportDashboardController({
      target,
      socketUrl: "https://support.example.com",
    });
    await controller.initialize();
    await controller.openConversation("conversation-1");
    expect(target.textContent).toContain("Internal note");
    expect(target.textContent).toContain("<img src=x");
    expect(target.querySelector("img")).toBeNull();
    controller.destroy();
  });
  it("filters notes and note composer without permissions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) =>
        String(input).endsWith("/agent/session")
          ? response({
              actor: {
                type: "agent",
                id: "viewer-1",
                role: "support_viewer",
                permissions: ["conversation.read"],
              },
            })
          : String(input).endsWith("/agent/conversations")
            ? response([conversation])
            : response({
                conversation,
                messages: [
                  {
                    ...message,
                    id: "note-1",
                    clientMessageId: "note-id-0001",
                    type: "internal_note",
                    senderType: "agent",
                    body: "private",
                  },
                ],
              }),
      ),
    );
    const target = document.createElement("div");
    const controller = new SupportDashboardController({
      target,
      socketUrl: "https://support.example.com",
    });
    await controller.initialize();
    await controller.openConversation("conversation-1");
    expect(target.textContent).not.toContain("private");
    expect(target.querySelector('[data-action="note"]')).toBeNull();
    expect(target.querySelector("textarea")).toBeNull();
    expect(target.textContent).toContain("Read-only access");
    expect(target.querySelector('[aria-label="Internal note"]')).toBeNull();
    controller.destroy();
  });
  it("destroys sockets, requests, listeners and DOM idempotently", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) =>
        String(input).endsWith("/agent/session")
          ? response({
              actor: {
                type: "agent",
                id: "agent-1",
                role: "support_agent",
                permissions: ["conversation.read"],
              },
            })
          : response([]),
      ),
    );
    const target = document.createElement("div");
    const controller = new SupportDashboardController({
      target,
      socketUrl: "https://support.example.com",
    });
    await controller.initialize();
    controller.destroy();
    controller.destroy();
    expect(socket.removeAllListeners).toHaveBeenCalledTimes(1);
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(target.childElementCount).toBe(0);
  });
  it("keeps multiple instances isolated", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) =>
        String(input).endsWith("/agent/session")
          ? response({
              actor: {
                type: "agent",
                id: "agent-1",
                role: "support_agent",
                permissions: ["conversation.read"],
              },
            })
          : response([conversation]),
      ),
    );
    const a = document.createElement("div"),
      b = document.createElement("div");
    const first = new SupportDashboardController({
        target: a,
        socketUrl: "https://support.example.com",
      }),
      second = new SupportDashboardController({
        target: b,
        socketUrl: "https://support.example.com",
      });
    await Promise.all([first.initialize(), second.initialize()]);
    first.destroy();
    expect(a.childElementCount).toBe(0);
    expect(b.textContent).toContain("Checkout problem");
    second.destroy();
  });

  it("keeps reply and note submissions on their explicit HTTP routes", async () => {
    const mutations: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/agent/session"))
          return response({
            actor: {
              type: "agent",
              id: "agent-1",
              role: "support_agent",
              permissions: [
                "conversation.read",
                "conversation.reply",
                "internal_note.read",
                "internal_note.create",
              ],
            },
          });
        if (url.endsWith("/agent/conversations"))
          return response([conversation]);
        if (
          init?.method === "POST" &&
          (url.endsWith("/messages") || url.endsWith("/notes"))
        ) {
          mutations.push(url);
          const inputBody = JSON.parse(String(init.body)) as {
            body: string;
            clientMessageId: string;
          };
          return response({
            ...message,
            id: url.endsWith("/notes") ? "note-new" : "reply-new",
            clientMessageId: inputBody.clientMessageId,
            type: url.endsWith("/notes") ? "internal_note" : "text",
            senderType: "agent",
            body: inputBody.body,
          });
        }
        return response({ conversation, messages: [] });
      }),
    );
    const target = document.createElement("div");
    const controller = new SupportDashboardController({
      target,
      socketUrl: "https://support.example.com",
    });
    await controller.initialize();
    await controller.openConversation("conversation-1");
    const enter = async (body: string) => {
      const textarea = target.querySelector("textarea") as HTMLTextAreaElement;
      textarea.value = body;
      textarea.dispatchEvent(new Event("input"));
      (
        target.querySelector('[data-action="send"]') as HTMLButtonElement
      ).click();
      await vi.waitFor(() => expect(target.textContent).toContain(body));
    };
    await enter("Public answer");
    (target.querySelector('[data-action="note"]') as HTMLButtonElement).click();
    await enter("Private context");
    expect(mutations).toEqual([
      "/api/support/agent/conversations/conversation-1/messages",
      "/api/support/agent/conversations/conversation-1/notes",
    ]);
    controller.destroy();
  });

  it("re-resolves identity and HTTP state after reconnect without duplicate messages", async () => {
    let sessionCalls = 0;
    let detailCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith("/agent/session")) {
          sessionCalls += 1;
          return response({
            actor: {
              type: "agent",
              id: "agent-1",
              role: "support_agent",
              permissions: ["conversation.read"],
            },
          });
        }
        if (url.endsWith("/agent/conversations"))
          return response([conversation]);
        if (url.includes("/agent/messages/"))
          return response({ created: true });
        detailCalls += 1;
        return response({ conversation, messages: [message] });
      }),
    );
    const target = document.createElement("div");
    const controller = new SupportDashboardController({
      target,
      socketUrl: "https://support.example.com",
    });
    await controller.initialize();
    await controller.openConversation("conversation-1");
    socketHandlers.get("connect")?.();
    socketHandlers.get("connect")?.();
    await vi.waitFor(() => expect(sessionCalls).toBe(2));
    await vi.waitFor(() => expect(detailCalls).toBeGreaterThan(1));
    expect(
      target.querySelectorAll('[aria-label="customer message"]'),
    ).toHaveLength(1);
    controller.destroy();
  });

  it("clears the previous agent's active data when the verified identity changes", async () => {
    let sessionCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith("/agent/session")) {
          sessionCalls += 1;
          return response({
            actor: {
              type: "agent",
              id: sessionCalls === 1 ? "agent-1" : "agent-2",
              role: "support_agent",
              permissions: ["conversation.read"],
            },
          });
        }
        if (url.endsWith("/agent/conversations"))
          return response([conversation]);
        if (url.includes("/agent/messages/"))
          return response({ created: true });
        return response({ conversation, messages: [message] });
      }),
    );
    const target = document.createElement("div");
    const controller = new SupportDashboardController({
      target,
      socketUrl: "https://support.example.com",
    });
    await controller.initialize();
    await controller.openConversation("conversation-1");
    expect(target.textContent).toContain("Need help");
    socketHandlers.get("connect")?.();
    socketHandlers.get("connect")?.();
    await vi.waitFor(() => expect(sessionCalls).toBe(2));
    await vi.waitFor(() =>
      expect(target.textContent).not.toContain("Need help"),
    );
    controller.destroy();
  });

  it("retries a failed send with the same clientMessageId without duplicates", async () => {
    const ids: string[] = [];
    let attempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/agent/session"))
          return response({
            actor: {
              type: "agent",
              id: "agent-1",
              role: "support_agent",
              permissions: ["conversation.read", "conversation.reply"],
            },
          });
        if (url.endsWith("/agent/conversations"))
          return response([conversation]);
        if (url.endsWith("/messages") && init?.method === "POST") {
          attempts += 1;
          const payload = JSON.parse(String(init.body)) as {
            body: string;
            clientMessageId: string;
          };
          ids.push(payload.clientMessageId);
          return attempts === 1
            ? response({ code: "INTERNAL_ERROR", message: "Unavailable" }, 500)
            : response({
                ...message,
                id: "message-retry",
                clientMessageId: payload.clientMessageId,
                senderType: "agent",
                body: payload.body,
              });
        }
        if (url.includes("/agent/messages/"))
          return response({ created: true });
        return response({ conversation, messages: [] });
      }),
    );
    const target = document.createElement("div");
    const controller = new SupportDashboardController({
      target,
      socketUrl: "https://support.example.com",
    });
    await controller.initialize();
    await controller.openConversation("conversation-1");
    const textarea = target.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "Retry safely";
    textarea.dispatchEvent(new Event("input"));
    (target.querySelector('[data-action="send"]') as HTMLButtonElement).click();
    await vi.waitFor(() =>
      expect(target.querySelector("[data-retry]")).not.toBeNull(),
    );
    (target.querySelector("[data-retry]") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(attempts).toBe(2));
    expect(ids[0]).toBe(ids[1]);
    expect(target.querySelectorAll(".sk-message-agent")).toHaveLength(1);
    controller.destroy();
  });

  it("clears private state when the verified HTTP session expires", async () => {
    let expired = false;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        if (String(input).endsWith("/agent/session"))
          return response({
            actor: {
              type: "agent",
              id: "agent-1",
              role: "support_agent",
              permissions: ["conversation.read"],
            },
          });
        if (expired)
          return response(
            { code: "UNAUTHENTICATED", message: "Session expired." },
            401,
          );
        return response([conversation]);
      }),
    );
    const target = document.createElement("div");
    const controller = new SupportDashboardController({
      target,
      socketUrl: "https://support.example.com",
    });
    await controller.initialize();
    expect(target.textContent).toContain("Checkout problem");
    expired = true;
    await controller.refreshInbox();
    expect(target.textContent).not.toContain("Checkout problem");
    expect(target.querySelector('[role="alert"]')).not.toBeNull();
    controller.destroy();
  });

  it("accepts one validated realtime customer message and rejects unauthorized notes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) =>
        String(input).endsWith("/agent/session")
          ? response({
              actor: {
                type: "agent",
                id: "agent-1",
                role: "support_viewer",
                permissions: ["conversation.read"],
              },
            })
          : String(input).endsWith("/agent/conversations")
            ? response([conversation])
            : String(input).includes("/agent/messages/")
              ? response({ created: true })
              : response({ conversation, messages: [] }),
      ),
    );
    const target = document.createElement("div");
    const controller = new SupportDashboardController({
      target,
      socketUrl: "https://support.example.com",
    });
    await controller.initialize();
    await controller.openConversation("conversation-1");
    const envelope = (
      eventId: string,
      eventType: "message.created" | "internal_note.created",
      data: unknown,
    ) => ({
      eventId,
      eventType,
      version: 1,
      conversationId: "conversation-1",
      occurredAt: now,
      data,
    });
    socketHandlers.get("message.created")?.(
      envelope("event-1", "message.created", message),
    );
    socketHandlers.get("message.created")?.(
      envelope("event-1", "message.created", message),
    );
    socketHandlers.get("internal_note.created")?.(
      envelope("event-2", "internal_note.created", {
        ...message,
        id: "note-secret",
        type: "internal_note",
        body: "Never visible",
      }),
    );
    expect(
      target.querySelectorAll('[aria-label="customer message"]'),
    ).toHaveLength(1);
    expect(target.textContent).not.toContain("Never visible");
    controller.destroy();
  });

  it("keeps reply and internal-note attachment drafts isolated", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith("/widget/config"))
          return response({
            features: { attachments: true, chatbot: false },
            attachments: {
              maxFileSizeBytes: 1,
              maxFilesPerMessage: 5,
              allowedMimeTypes: ["text/plain"],
            },
          });
        if (url.endsWith("/agent/session"))
          return response({
            actor: {
              type: "agent",
              id: "agent-1",
              role: "support_agent",
              permissions: [
                "conversation.read",
                "conversation.reply",
                "internal_note.read",
                "internal_note.create",
              ],
            },
          });
        if (url.endsWith("/agent/conversations"))
          return response([conversation]);
        return response({ conversation, messages: [] });
      }),
    );
    const target = document.createElement("div");
    const controller = new SupportDashboardController({ target });
    await controller.initialize();
    await controller.openConversation(conversation.id);
    const choose = (name: string) => {
      const input = target.querySelector<HTMLInputElement>(".sk-file-input");
      if (!input) throw new Error("File input was not rendered.");
      Object.defineProperty(input, "files", {
        configurable: true,
        value: [new File(["too large"], name, { type: "text/plain" })],
      });
      input.dispatchEvent(new Event("change"));
    };
    choose("public.txt");
    expect(target.textContent).toContain("public.txt");
    target.querySelector<HTMLElement>('[data-action="note"]')?.click();
    expect(target.textContent).not.toContain("public.txt");
    choose("private.txt");
    expect(target.textContent).toContain("private.txt");
    expect(target.textContent).not.toContain("public.txt");
    target.querySelector<HTMLElement>('[data-action="reply"]')?.click();
    expect(target.textContent).toContain("public.txt");
    expect(target.textContent).not.toContain("private.txt");
    controller.destroy();
  });
});
