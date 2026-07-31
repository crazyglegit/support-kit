import { expect, test } from "@playwright/test";

test("renders the foundation demo", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Support Kit foundation" }),
  ).toBeVisible();
  await expect(
    page.getByText("Product features are intentionally not implemented yet."),
  ).toBeVisible();
});
