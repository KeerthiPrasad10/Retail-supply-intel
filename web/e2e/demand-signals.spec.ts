import { test, expect } from "@playwright/test";

const MOCK_IDEA = {
  id: "test-1",
  title: "Test Idea",
  status: "complete" as const,
  createdAt: new Date().toISOString(),
  description: "",
  category: "",
  targetMarket: "",
  audience: "",
  priceTarget: "",
  features: "",
  imageUrl: "",
  submittedBy: "",
};

const RESEARCH = {
  mode: "demo" as const,
  ranAt: new Date().toISOString(),
  durationMs: 4200,
  enrichment: {
    suggestedCategory: "Drinkware",
    tags: ["hydration", "insulated"],
    targetAudience: "Hikers and commuters",
    summary: "An insulated water bottle for active users.",
  },
  benchmark: {
    competitors: [],
    priceRange: null,
    insights: [],
  },
  classification: null,
  suppliers: [],
  makers: [],
  demand: {
    posts: [
      {
        title: "Best insulated water bottle for long hikes?",
        url: "https://reddit.com/r/hydration/post1",
        source: "reddit" as const,
        channel: "r/hydration",
        engagement: 1243,
        comments: 87,
        createdAt: new Date().toISOString(),
      },
      {
        title: "Show HN: I built a smart hydration tracker",
        url: "https://news.ycombinator.com/item?id=1",
        source: "hackernews" as const,
        channel: "Hacker News",
        engagement: 312,
        comments: 54,
        createdAt: new Date().toISOString(),
      },
      {
        title: "Why is everyone obsessed with stainless steel bottles?",
        url: "https://reddit.com/r/hydration/post2",
        source: "reddit" as const,
        channel: "r/hydration",
        engagement: 876,
        comments: 41,
        createdAt: new Date().toISOString(),
      },
      {
        title: "Ask HN: best gear for staying hydrated at the desk?",
        url: "https://news.ycombinator.com/item?id=2",
        source: "hackernews" as const,
        channel: "Hacker News",
        engagement: 198,
        comments: 22,
        createdAt: new Date().toISOString(),
      },
    ],
    totalPosts: 4,
    totalEngagement: 2629,
    channels: ["r/hydration", "Hacker News"],
    momentum: "high" as const,
  },
  analysis: null,
  agents: [
    {
      id: "demand",
      name: "Demand Signals",
      description: "Reads community discussion",
      status: "complete" as const,
      detail: "Found 4 recent posts",
    },
  ],
  sources: [{ title: "Reddit", url: "https://reddit.com" }],
};

test.describe("Demand signals in research results", () => {
  test.beforeEach(async ({ page }) => {
    // Mock POST /api/ideas (create) and GET /api/ideas (list)
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

    // Mock POST /api/ideas/test-1/research — return idea with full research + demand
    await page.route("**/api/ideas/test-1/research", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ idea: { ...MOCK_IDEA, research: RESEARCH } }),
      });
    });
  });

  test("renders demand signals section, posts, badges and momentum tile", async ({ page }) => {
    await page.goto("/");

    // Open Product Ideas view from the sidebar
    await page.locator("aside.sidebar").getByText("Product Ideas").click();
    await expect(page.getByRole("heading", { name: "Product Ideas" })).toBeVisible();

    // Click "Add idea" to open the submit form
    await page.getByRole("button", { name: /Add idea/ }).first().click();

    // Fill the required title field and submit
    await page.locator("input[required]").first().fill("Insulated water bottle");
    await page.locator('button[type="submit"]').click();

    // Demand signals section renders
    const section = page.locator("section", { has: page.locator(".demand-grid") });
    await expect(page.getByText("Demand signals")).toBeVisible({ timeout: 15_000 });
    await expect(section.locator(".demand-card")).toHaveCount(4);

    // Post titles appear
    await expect(
      page.getByText("Best insulated water bottle for long hikes?"),
    ).toBeVisible();
    await expect(
      page.getByText("Show HN: I built a smart hydration tracker"),
    ).toBeVisible();

    // Channel badges appear
    await expect(section.locator(".demand-card .badge", { hasText: "r/hydration" }).first()).toBeVisible();
    await expect(section.locator(".demand-card .badge", { hasText: "Hacker News" }).first()).toBeVisible();

    // Demand momentum stat tile shows "High"
    const tile = page.locator(".stat", { hasText: "Demand momentum" }).first();
    await expect(tile).toContainText("High");
  });
});
