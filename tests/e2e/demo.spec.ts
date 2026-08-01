import { expect, test } from "@playwright/test";

test("renders the widget demo and opens the isolated launcher", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Support Kit interfaces" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Use the support launcher to start or continue a conversation.",
    ),
  ).toBeVisible();

  const host = page.locator("[data-support-widget]");
  await expect(host).toBeAttached();
  await host.locator("button.launcher").click();
  await expect(host.locator('[role="dialog"]')).toBeVisible();
});

test("supports keyboard focus, mobile layout, and system dark mode", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const launcher = page
    .locator("[data-support-widget]")
    .locator("button.launcher");
  await launcher.press("Enter");
  const host = page.locator("[data-support-widget]");
  const panel = host.locator('[role="dialog"]');
  await expect(panel).toBeVisible();
  await expect(host).toHaveAttribute("data-theme", "dark");
  const box = await panel.boundingBox();
  expect(box?.width).toBe(390);
  expect(box?.height).toBe(844);
  expect(
    await host.locator("style").evaluate((element) => element.textContent),
  ).toContain("prefers-reduced-motion:reduce");
  await expect(
    host.locator('.header button[aria-label="Close support"]'),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(host.locator(":focus")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(launcher).toBeFocused();
});

test("mounts the protected agent dashboard with accessible note isolation and responsive navigation", async ({
  page,
  context,
}) => {
  const timestamp = "2026-08-02T00:00:00.000Z";
  const conversation = {
    id: "conversation-1",
    status: "open",
    subject: "Checkout problem",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await context.addCookies([
    {
      name: "support_demo_agent",
      value: "playwright-agent-secret",
      url: "http://127.0.0.1:3000",
      httpOnly: true,
    },
  ]);
  await page.route("**/api/support/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith("/agent/session")
      ? {
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
        }
      : path.endsWith("/agent/conversations/conversation-1")
        ? {
            conversation,
            messages: [
              {
                id: "note-1",
                conversationId: "conversation-1",
                clientMessageId: "note-id-0001",
                type: "internal_note",
                senderType: "agent",
                body: "Agent-only context",
                deliveryStatus: "sent",
                createdAt: timestamp,
                updatedAt: timestamp,
              },
            ],
          }
        : path.endsWith("/agent/conversations")
          ? [conversation]
          : { receipt: {}, created: true };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data }),
    });
  });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/support");
  const dashboard = page.locator("[data-support-dashboard-host]");
  await expect(dashboard.getByRole("heading", { name: "Inbox" })).toBeVisible();
  await dashboard
    .getByRole("button", { name: /Checkout problem/ })
    .press("Enter");
  await expect(
    dashboard.getByRole("button", { name: "Back to inbox" }),
  ).toBeFocused();
  await expect(dashboard.getByLabel("Internal note")).toContainText(
    "Agent-only context",
  );
  await expect(
    dashboard.getByRole("button", { name: "Internal note" }),
  ).toBeVisible();
  await expect(dashboard.locator(".sk-dashboard")).toHaveAttribute(
    "data-theme",
    "dark",
  );
  expect(
    await dashboard.locator("style").evaluate((element) => element.textContent),
  ).toContain("prefers-reduced-motion:reduce");
  await dashboard.getByRole("button", { name: "Back to inbox" }).press("Enter");
  await expect(dashboard.getByRole("heading", { name: "Inbox" })).toBeVisible();
});
