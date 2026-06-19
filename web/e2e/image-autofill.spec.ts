import path from "path";
import { test, expect } from "@playwright/test";

const FIXTURE_JPEG = path.join(__dirname, "fixtures", "product.jpg");

const AUTOFILL_RESPONSE = {
  ok: true,
  fields: {
    title: "Test Product",
    description: "A test product",
    category: "Electronics & Accessories",
    features: "Feature 1\nFeature 2",
    priceTarget: "$20-$30",
    targetMarket: "US",
    audience: "Consumers",
  },
};

test.describe("Image upload + autofill on /submit", () => {
  test.beforeEach(async ({ page }) => {
    // Mock analyse-image API
    await page.route("**/api/ideas/analyse-image", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(AUTOFILL_RESPONSE),
      });
    });
  });

  test("uploading a JPEG triggers autofill and populates form fields", async ({ page }) => {
    await page.goto("/submit");

    // The hidden file input
    const fileInput = page.locator('input[type="file"]');

    // Set the file on the input (bypasses the UI click)
    await fileInput.setInputFiles(FIXTURE_JPEG);

    // The image preview should appear (we uploaded something)
    await expect(page.locator(".idea-image-preview")).toBeVisible({ timeout: 10_000 });

    // Wait for autofill to complete — badge says "Fields filled by AI"
    await expect(page.locator(".idea-analyse-badge.done")).toBeVisible({ timeout: 10_000 });

    // Title field should be populated with the mocked value
    const titleInput = page.locator('input[required]').first();
    await expect(titleInput).toHaveValue("Test Product");

    // Category field populated
    const categoryInput = page.locator('input[list="sp-category-options"]');
    await expect(categoryInput).toHaveValue("Electronics & Accessories");
  });
});

test.describe("Image upload + autofill on Product Ideas board (inline form)", () => {
  test.beforeEach(async ({ page }) => {
    // Mock GET /api/ideas
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

    // Mock analyse-image API
    await page.route("**/api/ideas/analyse-image", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(AUTOFILL_RESPONSE),
      });
    });
  });

  test("uploading image on in-dashboard form autofills fields", async ({ page }) => {
    await page.goto("/");

    // Navigate to Product Ideas
    await page.getByText("Product Ideas").click();

    // Click Add idea
    await page.locator(".ideas-board-empty .btn, .page-head .btn.primary").first().click();

    // The inline form should appear
    await expect(page.locator("form.panel.idea-form, form.idea-form")).toBeVisible({ timeout: 5_000 });

    // Set file on the hidden file input inside the form
    const fileInput = page.locator('form input[type="file"]');
    await fileInput.setInputFiles(FIXTURE_JPEG);

    // Image preview should appear
    await expect(page.locator(".idea-image-preview")).toBeVisible({ timeout: 10_000 });

    // Wait for "Fields filled by AI" badge
    await expect(page.locator(".idea-analyse-badge.done")).toBeVisible({ timeout: 10_000 });

    // The title input in the inline form should be populated
    const titleInput = page.locator("form.idea-form input[required], .idea-fields input[required]").first();
    await expect(titleInput).toHaveValue("Test Product");
  });
});
