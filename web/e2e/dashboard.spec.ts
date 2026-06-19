import { test, expect } from "@playwright/test";

test.describe("Dashboard loads", () => {
  test("renders sidebar and main content without JS errors", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.goto("/");

    // Sidebar should be present
    await expect(page.locator("aside.sidebar")).toBeVisible();

    // NxB logo mark in sidebar
    await expect(page.locator(".logo-mark")).toBeVisible();

    // Main navigation items
    await expect(page.getByText("Overview")).toBeVisible();
    await expect(page.getByText("Trending")).toBeVisible();
    await expect(page.getByText("Product Ideas")).toBeVisible();

    // Some main content area
    await expect(page.locator(".content, main, [class*='overview']")).toBeVisible();

    // No uncaught JS errors
    expect(jsErrors).toEqual([]);
  });
});
