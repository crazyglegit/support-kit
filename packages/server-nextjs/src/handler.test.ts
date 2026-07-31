import { SupportKitError, type SupportKit } from "@crazyglegit/support";
import { describe, expect, it, vi } from "vitest";
import { createSupportServer } from "./handler.js";

function unused(): never {
  throw new Error("Unexpected test operation.");
}

function kit(overrides?: Partial<SupportKit>): SupportKit {
  const base: SupportKit = {
    projectId: "project-1",
    conversations: {
      create: unused,
      sendMessage: unused,
      addInternalNote: unused,
      assign: unused,
      changeStatus: unused,
      reopen: unused,
      markSpam: unused,
      listForCustomer: unused,
      listInbox: unused,
    },
    messages: { list: unused, recordRead: unused },
    customers: { upsert: unused },
    agents: { upsert: unused },
    tags: { add: unused, remove: unused },
    auth: {
      resolveCustomer: () =>
        Promise.resolve({ type: "customer", id: "customer-1" }),
      resolveVisitor: unused,
      resolveAgent: () =>
        Promise.resolve({
          type: "agent",
          id: "agent-1",
          role: "support_agent",
          permissions: ["conversation.read"],
        }),
    },
    events: { subscribe: () => () => undefined },
    healthCheck: unused,
    dispose: () => Promise.resolve(),
  };
  return { ...base, ...overrides };
}

describe("createSupportServer", () => {
  it("routes and validates a customer conversation request", async () => {
    const create = vi.fn(
      (input: Parameters<SupportKit["conversations"]["create"]>[0]) =>
        Promise.resolve({
          conversation: {
            id: "conversation-1",
            projectId: "project-1",
            status: "open" as const,
            createdAt: new Date("2026-01-01"),
            updatedAt: new Date("2026-01-01"),
          },
          message: {
            id: "message-1",
            projectId: "project-1",
            conversationId: "conversation-1",
            senderType: "customer" as const,
            senderId: input.actor.id,
            type: "text" as const,
            body: input.initialMessage.body,
            deliveryStatus: "pending" as const,
            createdAt: new Date("2026-01-01"),
            updatedAt: new Date("2026-01-01"),
          },
        }),
    );
    const support = kit({ conversations: { ...kit().conversations, create } });
    const { POST } = createSupportServer(support, {
      allowedOrigins: ["https://app.test"],
    });
    const response = await POST(
      new Request("https://app.test/api/support/conversations", {
        method: "POST",
        headers: {
          origin: "https://app.test",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          initialMessage: { body: "Help", clientMessageId: "client-1" },
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { type: "customer", id: "customer-1" },
      }),
    );
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });

  it("rejects malformed input before invoking the SDK", async () => {
    const create = vi.fn();
    const support = kit({ conversations: { ...kit().conversations, create } });
    const { POST } = createSupportServer(support, {
      allowedOrigins: ["https://app.test"],
    });
    const response = await POST(
      new Request("https://app.test/api/support/conversations", {
        method: "POST",
        headers: {
          origin: "https://app.test",
          "content-type": "application/json",
        },
        body: JSON.stringify({ initialMessage: { body: "" } }),
      }),
    );

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("blocks disallowed mutation origins", async () => {
    const { POST } = createSupportServer(kit(), {
      allowedOrigins: ["https://app.test"],
    });
    const response = await POST(
      new Request("https://evil.test/api/support/session", {
        method: "POST",
        headers: { origin: "https://evil.test" },
      }),
    );
    expect(response.status).toBe(403);
  });

  it("does not initialize lazy support until a request is handled", async () => {
    const initialize = vi.fn(() => Promise.resolve(kit()));
    const { GET } = createSupportServer(initialize, {
      allowedOrigins: ["https://app.test"],
    });
    expect(initialize).not.toHaveBeenCalled();
    await GET(new Request("https://app.test/api/support/conversations"));
    expect(initialize).toHaveBeenCalledOnce();
  });

  it("returns sanitized authentication errors for agent routes", async () => {
    const support = kit({
      auth: {
        ...kit().auth,
        resolveAgent: () =>
          Promise.reject(
            new SupportKitError("UNAUTHENTICATED", "Sign in required."),
          ),
      },
    });
    const { GET } = createSupportServer(support, {
      allowedOrigins: ["https://app.test"],
    });
    const response = await GET(
      new Request("https://app.test/api/support/agent/conversations"),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "UNAUTHENTICATED", message: "Sign in required." },
    });
  });
});
