import { NextResponse } from "next/server";

/**
 * Scrape a product page URL and extract structured product info.
 *
 * POST /api/ideas/scrape-url  { url: string }
 * → { ok: true, fields: { title, description, category, features, targetMarket, audience, priceTarget, imageUrl } }
 *
 * The server fetches the page (avoids CORS), strips it to readable text, then
 * asks Claude to extract the product fields — same output shape as analyse-image
 * so the form can apply them identically.
 *
 * imageUrl is returned when an og:image / product image is found, letting the
 * form show a preview without the submitter having to upload a photo.
 *
 * Returns 501 with no API key, 400 on bad URL, 502 on fetch/AI failure.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODEL = "claude-sonnet-4-6";
const CATEGORIES = [
  "Apparel & Fashion",
  "Drinkware & Kitchen",
  "Home & Living",
  "Baby & Kids",
  "Beauty & Personal Care",
  "Sports & Outdoors",
  "Electronics & Accessories",
  "Pet Products",
];

function apiKey() {
  return process.env.ANTHROPIC_API_KEY || process.env.RSI_ANTHROPIC_API_KEY;
}

function isValidProductUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

// Strip HTML to plain text: remove scripts/styles, collapse whitespace.
// We extract og:image / product images separately before stripping.
function extractPageContent(html: string): { text: string; imageUrl: string } {
  // Find og:image or the first large product image URL.
  let imageUrl = "";
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogImage?.[1]) imageUrl = ogImage[1];

  // Remove <script>, <style>, <svg>, <nav>, <footer>, <header> blocks.
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+>/g, " ")          // strip remaining tags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, " ")           // collapse whitespace
    .trim();

  // Cap at ~8000 chars to stay well within token limits.
  if (text.length > 8000) text = text.slice(0, 8000) + "…";

  return { text, imageUrl };
}

function buildPrompt(pageText: string, url: string): string {
  return `You are extracting product information from a retail/e-commerce product page to help a buyer submit this product for internal review.

SOURCE URL: ${url}

PAGE TEXT (stripped HTML):
${pageText}

Extract product details for a sourcing form. Return ONLY a JSON object (no prose, no code fence) with these exact keys — leave a key as an empty string "" if truly not determinable:
{
  "title": "short product name (3-8 words)",
  "description": "2-3 sentence description: what it is, who it's for, what makes it useful",
  "category": "best matching category from: ${CATEGORIES.join(", ")}",
  "features": "key product features, one per line",
  "targetMarket": "likely target market(s) e.g. US, UK, Australia — infer from currency/language if not stated",
  "audience": "primary target audience e.g. Parents of young children",
  "priceTarget": "the listed price or price range with currency symbol e.g. $29.99 or $25–35, empty string if not found"
}`;
}

type ScrapeResult = {
  title?: string;
  description?: string;
  category?: string;
  features?: string;
  targetMarket?: string;
  audience?: string;
  priceTarget?: string;
};

function parseJson(text: string): ScrapeResult | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const key = apiKey();
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "AI not configured (set ANTHROPIC_API_KEY)." },
      { status: 501 },
    );
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const rawUrl = (body?.url ?? "").trim();
  if (!rawUrl || !isValidProductUrl(rawUrl)) {
    return NextResponse.json({ ok: false, error: "A valid https:// URL is required." }, { status: 400 });
  }

  // Fetch the page server-side (avoids browser CORS, uses server IP).
  let html: string;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    const pageRes = await fetch(rawUrl, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RSI-Scout/1.0; +https://retail-supply-intel.vercel.app)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!pageRes.ok) {
      return NextResponse.json(
        { ok: false, error: `Could not fetch that page (HTTP ${pageRes.status}). Try a different URL.` },
        { status: 502 },
      );
    }
    const ct = pageRes.headers.get("content-type") ?? "";
    if (!ct.includes("html")) {
      return NextResponse.json(
        { ok: false, error: "URL does not appear to be an HTML page." },
        { status: 400 },
      );
    }
    html = await pageRes.text();
  } catch (err) {
    const msg = err instanceof Error && err.name === "AbortError"
      ? "Page took too long to respond."
      : "Could not reach that URL.";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }

  const { text: pageText, imageUrl } = extractPageContent(html);
  if (!pageText) {
    return NextResponse.json({ ok: false, error: "Page returned no readable content." }, { status: 502 });
  }

  // Call Claude to extract structured product fields.
  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      messages: [{ role: "user", content: buildPrompt(pageText, rawUrl) }],
    }),
  });

  if (!claudeRes.ok) {
    const detail = await claudeRes.text();
    return NextResponse.json(
      { ok: false, error: `AI error (${claudeRes.status}): ${detail.slice(0, 200)}` },
      { status: 502 },
    );
  }

  const claudeData = await claudeRes.json();
  const responseText: string = (claudeData.content ?? [])
    .filter((b: { type?: string }) => b.type === "text")
    .map((b: { text?: string }) => b.text ?? "")
    .join("");

  const parsed = parseJson(responseText);
  if (!parsed) {
    return NextResponse.json({ ok: false, error: "Could not parse AI response." }, { status: 502 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return NextResponse.json({
    ok: true,
    fields: {
      title: str(parsed.title),
      description: str(parsed.description),
      category: str(parsed.category),
      features: str(parsed.features),
      targetMarket: str(parsed.targetMarket),
      audience: str(parsed.audience),
      priceTarget: str(parsed.priceTarget),
      imageUrl,
    },
  });
}
