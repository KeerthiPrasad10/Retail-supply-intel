import { chromium } from "@playwright/test";

const BASE = process.env.PREVIEW_URL || "https://retail-supply-intel-git-feat-demand-pulse-ifs-nxb.vercel.app";
const OUT = process.env.OUT_DIR || "/tmp/preview-shots";

const log = (...a) => console.log("[verify]", ...a);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1400 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") log("page-error:", m.text()); });

try {
  log("opening", BASE);
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60_000 });

  // Go to Product Ideas
  await page.getByText("Product Ideas", { exact: false }).first().click();
  await page.waitForTimeout(500);

  // Open the add-idea form
  const addBtn = page.getByRole("button", { name: /add idea/i }).first();
  if (await addBtn.isVisible().catch(() => false)) await addBtn.click();
  await page.waitForTimeout(500);

  // Fill the title (and a category to give the demand query a good term)
  const title = page.getByPlaceholder(/insulated|water bottle|e\.g\./i).first();
  await title.fill("Insulated stainless steel water bottle");

  await page.screenshot({ path: `${OUT}/01-form.png`, fullPage: true });
  log("submitting idea…");

  // Submit
  await page.getByRole("button", { name: /add idea & research|submit idea/i }).first().click();

  // Wait for research to complete — results view renders .idea-results, error shows text.
  log("waiting for research to complete (up to 90s)…");
  await Promise.race([
    page.waitForSelector(".ideas-results", { timeout: 90_000 }),
    page.waitForSelector("text=Research did not", { timeout: 90_000 }),
    page.waitForSelector("text=Research failed", { timeout: 90_000 }),
  ]);
  await page.waitForTimeout(1000);

  const hasDemand = await page.locator(".demand-grid").isVisible().catch(() => false);
  log("Demand signals section visible:", hasDemand);

  if (hasDemand) {
    await page.locator(".demand-grid").scrollIntoViewIfNeeded();
    const cards = await page.locator(".demand-card").count();
    log("demand cards:", cards);
    const momentum = await page.locator(".stat", { hasText: /Demand momentum/i }).innerText().catch(() => "(no momentum tile)");
    log("momentum tile:", momentum.replace(/\n/g, " "));
  }

  await page.screenshot({ path: `${OUT}/02-results.png`, fullPage: true });
  log("done. screenshots in", OUT);
  process.exitCode = hasDemand ? 0 : 2;
} catch (err) {
  log("ERROR:", err.message);
  await page.screenshot({ path: `${OUT}/error.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
