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

    // Main navigation items — scope to the sidebar to avoid strict-mode violations
    // (the active view breadcrumb also contains these strings)
    const sidebar = page.locator("aside.sidebar");
    await expect(sidebar.getByText("Overview")).toBeVisible();
    await expect(sidebar.getByText("Trending")).toBeVisible();
    await expect(sidebar.getByText("Product Ideas")).toBeVisible();

    // Main page wrapper is present
    await expect(page.locator("main.page")).toBeVisible();

    // No uncaught JS errors
    expect(jsErrors).toEqual([]);
  });
});
