import { test, expect } from "@playwright/test";

const MOCK_IDEA = {
  id: "test-1",
  title: "Test Idea",
  status: "queued" as const,
  createdAt: new Date().toISOString(),
  description: "",
  category: "",
  targetMarket: "",
  audience: "",
  priceTarget: "",
  features: "",
  submittedBy: "",
};

test.describe("Submit idea form at /submit", () => {
  test.beforeEach(async ({ page }) => {
    // Mock POST /api/ideas
    await page.route("**/api/ideas", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ idea: MOCK_IDEA }),
        });
      } else if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ideas: [] }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock POST /api/ideas/test-1/research (background fire, non-blocking)
    await page.route("**/api/ideas/test-1/research", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ idea: { ...MOCK_IDEA, status: "complete" } }),
      });
    });
  });

  test("form renders with required fields and submit button", async ({ page }) => {
    await page.goto("/submit");

    // Header
    await expect(page.getByText("Submit a product idea")).toBeVisible();

    // Product title field (required)
    await expect(page.locator('input[placeholder*="water bottle"], input[required]').first()).toBeVisible();

    // Submit button
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("fills title and submits, shows success screen", async ({ page }) => {
    await page.goto("/submit");

    // Fill in the title (required field)
    const titleInput = page.locator('input[required]').first();
    await titleInput.fill("My Test Product");

    // Click Submit idea
    await page.locator('button[type="submit"]').click();

    // Success screen: "Added to the product board"
    await expect(page.getByText("Added to the product board")).toBeVisible({ timeout: 10_000 });

    // The idea title appears in the success screen
    await expect(page.getByText("Test Idea")).toBeVisible();

    // "Submit another" button is present
    await expect(page.getByText("Submit another")).toBeVisible();
  });

  test("shows validation error when submitting without a title", async ({ page }) => {
    await page.goto("/submit");

    // Click submit without filling title
    await page.locator('button[type="submit"]').click();

    // Should show a validation error
    await expect(page.getByText("Please give your product idea a title.")).toBeVisible();
  });

  test("Submit another resets back to the form", async ({ page }) => {
    await page.goto("/submit");

    const titleInput = page.locator('input[required]').first();
    await titleInput.fill("My Test Product");
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText("Added to the product board")).toBeVisible({ timeout: 10_000 });

    // Click "Submit another"
    await page.getByText("Submit another").click();

    // Should be back at the form
    await expect(page.getByText("Submit a product idea")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
