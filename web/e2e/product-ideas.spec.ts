import { test, expect } from "@playwright/test";

test.describe("Product Ideas board", () => {
  test.beforeEach(async ({ page }) => {
    // Mock GET /api/ideas to return empty list
    await page.route("**/api/ideas", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ideas: [] }),
        });
      } else {
        await route.continue();
      }
    });
  });

  test("navigates to Product Ideas and shows board", async ({ page }) => {
    await page.goto("/");

    // Click "Product Ideas" in the sidebar
    await page.getByText("Product Ideas").click();

    // The page title should appear
    await expect(page.getByText("Product Ideas", { exact: false })).toBeVisible();

    // Either empty state or the board itself
    const emptyState = page.locator(".ideas-board-empty");
    const board = page.locator(".ideas-board");

    // At least one of them should be visible
    await expect(emptyState.or(board)).toBeVisible();
  });

  test("empty state shows 'No ideas yet' when API returns empty", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Product Ideas").click();

    await expect(page.getByText("No ideas yet")).toBeVisible();
    // The Add idea button should be present in the empty state
    await expect(page.locator(".ideas-board-empty .btn")).toBeVisible();
  });
});
