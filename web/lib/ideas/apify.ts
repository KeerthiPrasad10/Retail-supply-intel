import "server-only";

import type { Competitor, Supplier } from "./types";

/* Apify agents — marketplace-native scrapers for Amazon (online stores) and
 * AliExpress (China suppliers). Degrade gracefully: with no APIFY_API_TOKEN
 * every call returns an empty list. */

const BASE = "https://api.apify.com/v2";

// Marketplace-native actors (richer than generic web extraction).
const AMAZON_ACTOR = "junglee~Amazon-crawler";
const ALIEXPRESS_ACTOR = "thirdwatch~aliexpress-product-scraper";

export function apifyEnabled(): boolean {
  return Boolean(process.env.APIFY_API_TOKEN);
}

function normalizeCurrency(c: string): string {
  const up = (c || "").toUpperCase();
  if (up === "$" || up === "US$") return "USD";
  if (up === "£") return "GBP";
  if (up === "€") return "EUR";
  if (up === "A$") return "AUD";
  return up;
}

async function runActor(
  actorId: string,
  input: unknown,
  timeoutMs: number
): Promise<Record<string, unknown>[] | null> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(
      `${BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: ctrl.signal,
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data)) return data as Record<string, unknown>[];
    const items = (data as { items?: unknown })?.items;
    return Array.isArray(items) ? (items as Record<string, unknown>[]) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Amazon — the dominant online store: brands, prices, sellers, ratings, reviews.
export async function amazonSearch(query: string, limit = 8): Promise<Competitor[]> {
  const url = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
  const items = await runActor(
    AMAZON_ACTOR,
    { categoryOrProductUrls: [{ url }], maxItemsPerStartUrl: limit, maxSearchPagesPerStartUrl: 1 },
    180_000
  );
  if (!items) return [];

  return items
    .map((i) => i as Record<string, unknown>)
    .filter((i) => i?.title && (i?.price as Record<string, unknown>)?.value)
    .slice(0, limit)
    .map((i) => {
      const price = i.price as { value?: unknown; currency?: unknown };
      const cur = normalizeCurrency(String(price?.currency || "$"));
      return {
        name: String(i.title).trim(),
        brand: i.brand ? String(i.brand).trim() : "",
        price: `${cur === "USD" ? "$" : cur + " "}${price.value}`,
        priceValue: typeof price.value === "number" ? price.value : null,
        currency: cur,
        features: [],
        url: i.url ? String(i.url) : "",
        source: "amazon.com",
        rating: typeof i.stars === "number" ? i.stars : null,
        reviews: typeof i.reviewsCount === "number" ? i.reviewsCount : null,
      } satisfies Competitor;
    });
}

// AliExpress — China sellers/suppliers: wholesale-ish prices, order volume, ratings.
export async function aliexpressSuppliers(query: string, limit = 8): Promise<Supplier[]> {
  const items = await runActor(
    ALIEXPRESS_ACTOR,
    {
      queries: [query],
      maxResults: limit,
      country: "US",
      proxyConfiguration: { useApifyProxy: true },
    },
    180_000
  );
  if (!items) return [];

  return items
    .map((i) => i as Record<string, unknown>)
    .filter((i) => i?.title && i?.url)
    .slice(0, limit)
    .map((i) => {
      const cur = normalizeCurrency(String(i.sale_price_currency || "USD"));
      const price = i.sale_price != null ? `${cur === "USD" ? "$" : cur + " "}${i.sale_price}` : "";
      return {
        name: String(i.title).trim(),
        url: String(i.url),
        snippet: Array.isArray(i.selling_points) ? i.selling_points.join(" · ") : "",
        price,
        orders: typeof i.orders_count === "number" ? i.orders_count : null,
        rating: typeof i.rating === "number" ? i.rating : null,
        source: "aliexpress",
      } satisfies Supplier;
    });
}
