// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupportWidget } from "./controller.js";

const responses: Record<string, unknown> = {
  "/api/support/widget/config": {
    features: { attachments: false, chatbot: false },
  },
  "/api/support/session": { actor: { type: "visitor" } },
  "/api/support/conversations": [],
};

function envelope(data: unknown, status = 200): Response {
  return Response.json(status < 400 ? { success: true, data } : data, {
    status,
  });
}

beforeEach(() => {
  responses["/api/support/conversations"] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL | Request) => {
      const path =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.pathname
            : new URL(input.url).pathname;
      return Promise.resolve(envelope(responses[path]));
    }),
  );
});
afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("SupportWidgetController", () => {
  it("isolates styles, opens with keyboard-equivalent activation, and restores focus", () => {
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    const widget = createSupportWidget();
    const host = document.querySelector<HTMLElement>("[data-support-widget]");
    expect(host?.shadowRoot?.querySelector("style")).not.toBeNull();
    widget.open();
    expect(widget.isOpen()).toBe(true);
    widget.close();
    expect(document.activeElement).toBe(outside);
    widget.destroy();
    expect(host?.isConnected).toBe(false);
  });

  it("keeps multiple instances isolated and cleans up one independently", () => {
    const first = createSupportWidget();
    const second = createSupportWidget();
    first.open();
    expect(first.isOpen()).toBe(true);
    expect(second.isOpen()).toBe(false);
    first.destroy();
    expect(document.querySelectorAll("[data-support-widget]")).toHaveLength(1);
    second.destroy();
  });

  it("never renders an unexpected internal note payload", async () => {
    responses["/api/support/conversations"] = [
      {
        id: "c1",
        status: "open",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const conversation = {
      id: "c1",
      status: "open",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    responses["/api/support/conversations"] = [conversation];
    responses["/api/support/conversations/c1"] = { conversation };
    responses["/api/support/conversations/c1/messages"] = [
      {
        id: "n1",
        conversationId: "c1",
        type: "internal_note",
        senderType: "agent",
        body: "SECRET NOTE",
        deliveryStatus: "delivered",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const widget = createSupportWidget();
    widget.open();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const root = document.querySelector<HTMLElement>(
      "[data-support-widget]",
    )?.shadowRoot;
    root?.querySelector<HTMLButtonElement>('[data-action="list"]')?.click();
    root
      ?.querySelector<HTMLButtonElement>('[data-action="conversation"]')
      ?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(root?.textContent).not.toContain("SECRET NOTE");
    widget.destroy();
  });
});
