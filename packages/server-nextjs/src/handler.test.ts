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
    attachments: {
      createUploadIntent: unused,
      completeUpload: unused,
      deletePending: unused,
      getDownload: unused,
    },
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
  it("resolves an agent session only through verified server authentication", async () => {
    const { POST } = createSupportServer(kit(), {
      allowedOrigins: ["https://app.test"],
    });
    const response = await POST(
      new Request("https://app.test/api/support/agent/session", {
        method: "POST",
        headers: { origin: "https://app.test" },
      }),
    );
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        actor: {
          type: "agent",
          id: "agent-1",
          role: "support_agent",
          permissions: ["conversation.read"],
        },
      },
    });
  });

  it("allowlists agent inbox and message history without project or sender identifiers", async () => {
    const timestamp = new Date("2026-01-01T00:00:00.000Z");
    const conversation = {
      id: "conversation-1",
      projectId: "project-secret",
      status: "open" as const,
      subject: "Help",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const support = kit({
      conversations: {
        ...kit().conversations,
        listInbox: () => Promise.resolve([conversation]),
      },
      messages: {
        ...kit().messages,
        list: () =>
          Promise.resolve([
            {
              id: "message-1",
              projectId: "project-secret",
              conversationId: "conversation-1",
              type: "internal_note",
              senderType: "agent",
              senderId: "agent-secret",
              body: "Agent only",
              deliveryStatus: "sent",
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          ]),
      },
    });
    const { GET } = createSupportServer(support, {
      allowedOrigins: ["https://app.test"],
    });
    const response = await GET(
      new Request(
        "https://app.test/api/support/agent/conversations/conversation-1",
      ),
    );
    const json = JSON.stringify(await response.json());
    expect(json).toContain("Agent only");
    expect(json).not.toContain("project-secret");
    expect(json).not.toContain("agent-secret");
  });
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

  it("resolves a verified visitor only after customer authentication declines", async () => {
    const resolveCustomer = vi.fn(() =>
      Promise.reject(new SupportKitError("UNAUTHENTICATED", "Not signed in.")),
    );
    const resolveVisitor = vi.fn(() =>
      Promise.resolve({ type: "visitor" as const, id: "verified-visitor" }),
    );
    const support = kit({
      auth: { ...kit().auth, resolveCustomer, resolveVisitor },
    });
    const { POST } = createSupportServer(support, {
      allowedOrigins: ["https://app.test"],
    });
    const response = await POST(
      new Request("https://app.test/api/support/session", {
        method: "POST",
        headers: { origin: "https://app.test" },
      }),
    );
    expect(resolveCustomer).toHaveBeenCalledOnce();
    expect(resolveVisitor).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { actor: { type: "visitor", id: "verified-visitor" } },
    });
  });

  it("returns a sanitized error when neither customer nor visitor is verified", async () => {
    const unauthenticated = () =>
      Promise.reject(
        new SupportKitError("UNAUTHENTICATED", "Session expired."),
      );
    const support = kit({
      auth: {
        ...kit().auth,
        resolveCustomer: unauthenticated,
        resolveVisitor: unauthenticated,
      },
    });
    const { POST } = createSupportServer(support, {
      allowedOrigins: ["https://app.test"],
    });
    const response = await POST(
      new Request("https://app.test/api/support/session", {
        method: "POST",
        headers: { origin: "https://app.test" },
      }),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "UNAUTHENTICATED", message: "Session expired." },
    });
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

  it("returns only browser-safe widget configuration", async () => {
    const { GET } = createSupportServer(kit(), {
      allowedOrigins: ["https://app.test"],
      widget: { title: "Acme help", greeting: "Welcome" },
      features: { attachments: true, chatbot: false },
    });
    const response = await GET(
      new Request("https://app.test/api/support/widget/config"),
    );
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        title: "Acme help",
        greeting: "Welcome",
        features: { attachments: true, chatbot: false },
      },
    });
  });

  it("allowlists customer messages and defensively removes internal notes", async () => {
    const timestamp = new Date("2026-01-01T00:00:00.000Z");
    const support = kit({
      messages: {
        ...kit().messages,
        list: () =>
          Promise.resolve([
            {
              id: "message-public",
              projectId: "project-secret",
              conversationId: "conversation-1",
              type: "text",
              senderType: "agent",
              senderId: "agent-secret",
              body: "Public reply",
              deliveryStatus: "delivered",
              createdAt: timestamp,
              updatedAt: timestamp,
            },
            {
              id: "message-note",
              projectId: "project-secret",
              conversationId: "conversation-1",
              type: "internal_note",
              senderType: "agent",
              body: "Never expose this",
              deliveryStatus: "delivered",
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          ]),
      },
    });
    const { GET } = createSupportServer(support, {
      allowedOrigins: ["https://app.test"],
    });
    const response = await GET(
      new Request(
        "https://app.test/api/support/conversations/conversation-1/messages",
      ),
    );
    const payload = JSON.stringify(await response.json());
    expect(payload).toContain("Public reply");
    expect(payload).not.toContain("Never expose this");
    expect(payload).not.toContain("project-secret");
    expect(payload).not.toContain("agent-secret");
  });

  it("derives mine filtering and self-assignment from the verified agent", async () => {
    const listInbox = vi.fn(() => Promise.resolve([]));
    const assign = vi.fn(
      (input: Parameters<SupportKit["conversations"]["assign"]>[0]) => {
        void input;
        return Promise.resolve({
          id: "assignment-1",
          projectId: "project-1",
          conversationId: "conversation-1",
          agentId: "agent-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      },
    );
    const support = kit({
      conversations: { ...kit().conversations, listInbox, assign },
    });
    const handlers = createSupportServer(support, {
      allowedOrigins: ["https://app.test"],
    });
    await handlers.GET(
      new Request(
        "https://app.test/api/support/agent/conversations?assignment=mine",
      ),
    );
    await handlers.POST(
      new Request(
        "https://app.test/api/support/agent/conversations/conversation-1/assign-self",
        { method: "POST", headers: { origin: "https://app.test" } },
      ),
    );
    expect(listInbox).toHaveBeenCalledWith(
      expect.objectContaining({ assignedToAgentId: "agent-1" }),
    );
    expect(assign.mock.calls[0]?.[0]).toMatchObject({
      agentId: "agent-1",
      actor: { id: "agent-1" },
    });
  });

  it("keeps reply and internal-note routes type-isolated and server-authorized", async () => {
    const timestamp = new Date("2026-01-01T00:00:00.000Z");
    const result = (type: "text" | "internal_note") => ({
      id: `${type}-1`,
      projectId: "project-1",
      conversationId: "conversation-1",
      clientMessageId: "client-id-0001",
      type,
      senderType: "agent" as const,
      body: "Body",
      deliveryStatus: "sent" as const,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const sendMessage = vi.fn(() => Promise.resolve(result("text")));
    const addInternalNote = vi.fn(() =>
      Promise.resolve(result("internal_note")),
    );
    const support = kit({
      conversations: { ...kit().conversations, sendMessage, addInternalNote },
    });
    const { POST } = createSupportServer(support, {
      allowedOrigins: ["https://app.test"],
    });
    const request = (route: string) =>
      POST(
        new Request(
          `https://app.test/api/support/agent/conversations/conversation-1/${route}`,
          {
            method: "POST",
            headers: {
              origin: "https://app.test",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              body: "Body",
              clientMessageId: "client-id-0001",
            }),
          },
        ),
      );
    expect((await request("messages")).status).toBe(201);
    expect((await request("notes")).status).toBe(201);
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(addInternalNote).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledWith(
      expect.not.objectContaining({ type: "internal_note" }),
    );
  });

  it("uses public SDK operations for status, spam, tags, and agent receipts", async () => {
    const changeStatus = vi.fn(() =>
      Promise.resolve({
        id: "conversation-1",
        projectId: "project-1",
        status: "resolved" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    const markSpam = vi.fn(() =>
      Promise.resolve({
        id: "conversation-1",
        projectId: "project-1",
        status: "spam" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    const add = vi.fn(() => Promise.resolve());
    const remove = vi.fn(() => Promise.resolve());
    const recordRead = vi.fn(
      (input: Parameters<SupportKit["messages"]["recordRead"]>[0]) => {
        void input;
        return Promise.resolve({
          created: true,
          receipt: {
            id: "receipt-1",
            projectId: "project-1",
            conversationId: "conversation-1",
            messageId: "message-1",
            readerType: "agent" as const,
            readerId: "agent-1",
            readAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      },
    );
    const support = kit({
      conversations: { ...kit().conversations, changeStatus, markSpam },
      tags: { add, remove },
      messages: { ...kit().messages, recordRead },
    });
    const handlers = createSupportServer(support, {
      allowedOrigins: ["https://app.test"],
    });
    const mutation = (
      method: "POST" | "PATCH" | "DELETE",
      path: string,
      body?: unknown,
    ) =>
      handlers[method](
        new Request(`https://app.test/api/support${path}`, {
          method,
          headers: {
            origin: "https://app.test",
            ...(body ? { "content-type": "application/json" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        }),
      );
    await mutation("PATCH", "/agent/conversations/conversation-1", {
      status: "resolved",
    });
    await mutation("POST", "/agent/conversations/conversation-1/spam");
    await mutation("POST", "/agent/conversations/conversation-1/tags/tag-1");
    await mutation("DELETE", "/agent/conversations/conversation-1/tags/tag-1");
    await mutation("POST", "/agent/messages/message-1/read");
    expect(changeStatus).toHaveBeenCalledOnce();
    expect(markSpam).toHaveBeenCalledOnce();
    expect(add).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(recordRead.mock.calls[0]?.[0]).toMatchObject({
      actor: { type: "agent" },
    });
  });

  it("denies customer or visitor sessions when verified agent authentication fails", async () => {
    const support = kit({
      auth: {
        ...kit().auth,
        resolveAgent: () =>
          Promise.reject(
            new SupportKitError("UNAUTHENTICATED", "Agent session required."),
          ),
      },
    });
    const { GET } = createSupportServer(support, {
      allowedOrigins: ["https://app.test"],
    });
    const response = await GET(
      new Request("https://app.test/api/support/agent/conversations", {
        headers: { "x-demo-customer-id": "customer-1" },
      }),
    );
    expect(response.status).toBe(401);
  });

  it.each([
    ["notes", "FORBIDDEN", 403],
    ["resolve", "INVALID_STATE_TRANSITION", 409],
  ] as const)(
    "preserves server authorization for %s failures",
    async (route, code, status) => {
      const failure = () =>
        Promise.reject(
          new SupportKitError(code, "The server rejected this action."),
        );
      const support = kit({
        conversations: {
          ...kit().conversations,
          addInternalNote: failure,
          changeStatus: failure,
        },
      });
      const { POST } = createSupportServer(support, {
        allowedOrigins: ["https://app.test"],
      });
      const response = await POST(
        new Request(
          `https://app.test/api/support/agent/conversations/conversation-1/${route}`,
          {
            method: "POST",
            headers: {
              origin: "https://app.test",
              "content-type": "application/json",
            },
            ...(route === "notes"
              ? {
                  body: JSON.stringify({
                    body: "Private",
                    clientMessageId: "client-id-0001",
                  }),
                }
              : {}),
          },
        ),
      );
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        error: { code },
      });
    },
  );

  it("maps customer and agent attachment routes without accepting project or uploader identity", async () => {
    let receivedUploadIntent: unknown;
    const createUploadIntent = vi.fn((input: unknown) => {
      receivedUploadIntent = input;
      return Promise.resolve({
        attachment: {
          id: "attachment-1",
          fileName: "safe.txt",
          mediaType: "text/plain",
          sizeBytes: 4,
          status: "pending_upload" as const,
        },
        upload: {
          method: "PUT" as const,
          url: "https://storage.test/upload",
          headers: { "content-type": "text/plain" },
          expiresAt: "2026-08-02T00:05:00.000Z",
        },
      });
    });
    const getDownload = vi.fn(() =>
      Promise.resolve({
        url: "https://storage.test/download",
        expiresAt: "2026-08-02T00:02:00.000Z",
      }),
    );
    const support = kit({
      attachments: {
        ...kit().attachments,
        createUploadIntent,
        getDownload,
      },
    });
    const handlers = createSupportServer(support, {
      allowedOrigins: ["https://app.test"],
    });
    const intent = await handlers.POST(
      new Request("https://app.test/api/support/attachments/upload-intents", {
        method: "POST",
        headers: {
          origin: "https://app.test",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: "conversation-1",
          fileName: "safe.txt",
          mimeType: "text/plain",
          sizeBytes: 4,
          projectId: "attacker-project",
        }),
      }),
    );
    expect(intent.status).toBe(400);
    const valid = await handlers.POST(
      new Request(
        "https://app.test/api/support/agent/attachments/upload-intents",
        {
          method: "POST",
          headers: {
            origin: "https://app.test",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            conversationId: "conversation-1",
            fileName: "safe.txt",
            mimeType: "text/plain",
            sizeBytes: 4,
            purpose: "internal_note",
          }),
        },
      ),
    );
    expect(valid.status).toBe(201);
    expect(receivedUploadIntent).toMatchObject({
      actor: { type: "agent" },
      purpose: "internal_note",
    });
    expect(receivedUploadIntent).not.toHaveProperty("projectId");
    const download = await handlers.GET(
      new Request(
        "https://app.test/api/support/attachments/attachment-1/download?conversationId=conversation-1",
      ),
    );
    expect(download.status).toBe(200);
    expect(getDownload).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { type: "customer", id: "customer-1" },
      }),
    );
  });
});
