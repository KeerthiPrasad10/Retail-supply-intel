import "server-only";

import type { Competitor, Supplier } from "./types";

/* Apify agents — marketplace-native scrapers for Amazon (online stores),
 * AliExpress (China suppliers), and Reddit (demand signals).
 * Degrade gracefully: with no APIFY_API_TOKEN every call returns an empty list. */

const BASE = "https://api.apify.com/v2";

// Marketplace-native actors (richer than generic web extraction).
const AMAZON_ACTOR = "junglee~Amazon-crawler";
// piotrv1001/aliexpress-listings-scraper: 99.9% success, returns store name/ID
const ALIEXPRESS_ACTOR = "piotrv1001~aliexpress-listings-scraper";
// nifty.codes/alibaba-suppliers-scraper: B2B company/manufacturer data + MOQs
const ALIBABA_ACTOR = "nifty.codes~alibaba-suppliers-scraper";
// agenscrape/made-in-china-com-product-scraper: cheapest, MOQ-specific data
const MADE_IN_CHINA_ACTOR = "agenscrape~made-in-china-com-product-scraper";

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
    if (!res.ok) {
      // 404/403 usually means the actor isn't rented on this account; log it so
      // "no results" can be told apart from "actor unavailable".
      const body = await res.text().catch(() => "");
      console.error(`[apify] ${actorId} → HTTP ${res.status}${body ? `: ${body.slice(0, 160)}` : ""}`);
      return null;
    }
    const data = await res.json();
    if (Array.isArray(data)) return data as Record<string, unknown>[];
    const items = (data as { items?: unknown })?.items;
    return Array.isArray(items) ? (items as Record<string, unknown>[]) : null;
  } catch (err) {
    console.error(`[apify] ${actorId} threw — ${err instanceof Error ? err.message : "request failed"}`);
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

// Reddit — community discussion via trudax/reddit-scraper-lite (pay-per-result).
// Returns raw post objects mapped to DemandPost shape (imported by demand.ts).
const REDDIT_ACTOR = "harshmaur~reddit-scraper";

export type RedditPost = {
  title: string;
  url: string;
  subreddit: string;
  score: number;
  numComments: number;
  createdAt: string;
};

export async function redditSearch(query: string, limit = 12): Promise<RedditPost[]> {
  const items = await runActor(
    REDDIT_ACTOR,
    {
      searchTerms: [query],
      searchPosts: true,
      searchComments: false,
      searchCommunities: false,
      searchSort: "top",
      searchTime: "month",
      maxPostsCount: limit,
    },
    90_000
  );
  if (!items) return [];

  return items
    .map((i) => i as Record<string, unknown>)
    .filter((i) => i?.title && (i?.postUrl ?? i?.url))
    .slice(0, limit)
    .map((i) => ({
      title: String(i.title),
      url: String(i.postUrl ?? i.url),
      // harshmaur/reddit-scraper uses subredditName / communityName
      subreddit: String(i.subredditName ?? i.communityName ?? i.subreddit ?? "").replace(/^r\//, ""),
      score: Number(i.score ?? i.upVotes ?? i.upvotes ?? 0),
      numComments: Number(i.commentsCount ?? i.numberOfComments ?? i.num_comments ?? 0),
      createdAt: (() => {
        const raw = i.createdAt ?? i.created_utc ?? 0;
        if (typeof raw === "string") return new Date(raw).toISOString();
        const ts = Number(raw);
        return new Date(ts < 1e12 ? ts * 1000 : ts).toISOString();
      })(),
    }));
}

// AliExpress — China sellers with store names (piotrv1001/aliexpress-listings-scraper,
// 99.9% success rate, returns storeName + storeId + storeUrl).
export async function aliexpressSuppliers(query: string, limit = 8): Promise<Supplier[]> {
  const searchUrl = `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(query)}`;
  const items = await runActor(
    ALIEXPRESS_ACTOR,
    {
      searchUrls: [{ url: searchUrl }],
      maxItems: limit,
      proxy: { useApifyProxy: true },
    },
    180_000
  );
  if (!items) return [];

  return items
    .map((i) => i as Record<string, unknown>)
    .filter((i) => (i?.title || i?.name) && i?.url)
    .slice(0, limit)
    .map((i) => {
      // piotrv1001 actor exposes storeName, storeId, storeUrl
      const storeObj = (i.store ?? i.seller ?? i.shop) as Record<string, unknown> | string | undefined;
      const store =
        String(
          i.storeName ??
            i.store_name ??
            i.sellerName ??
            i.seller_name ??
            (typeof storeObj === "string" ? storeObj : (storeObj as Record<string, unknown>)?.name) ??
            ""
        ).trim() || undefined;
      const cur = normalizeCurrency(String(i.currency ?? i.sale_price_currency ?? "USD"));
      const priceVal = i.price ?? i.salePrice ?? i.sale_price;
      const price = priceVal != null ? `${cur === "USD" ? "$" : cur + " "}${priceVal}` : "";
      const orders = i.tradeCount ?? i.orders ?? i.orders_count;
      return {
        name: String(i.title ?? i.name).trim(),
        url: String(i.url),
        snippet: Array.isArray(i.selling_points) ? i.selling_points.join(" · ") : "",
        price,
        orders: typeof orders === "number" ? orders : null,
        rating: typeof i.rating === "number" ? i.rating : (typeof i.stars === "number" ? i.stars : null),
        source: "aliexpress",
        store,
      } satisfies Supplier;
    });
}

// Alibaba — B2B supplier directory (nifty.codes/alibaba-suppliers-scraper).
// Returns company names, verification status, ratings, revenue, reorder rates.
export async function alibabaSuppliers(query: string, limit = 8): Promise<Supplier[]> {
  const url = `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(query)}`;
  const items = await runActor(
    ALIBABA_ACTOR,
    {
      startUrls: [{ url }],
      maxItems: limit,
      enablePagination: false,
      proxyConfiguration: { useApifyProxy: true },
    },
    180_000
  );
  if (!items) return [];

  return items
    .map((i) => i as Record<string, unknown>)
    .filter((i) => (i?.companyName ?? i?.name ?? i?.title) && i?.url)
    .slice(0, limit)
    .map((i) => {
      const company = i.companyName ?? i.company ?? i.name ?? i.title;
      const store = typeof company === "string" ? company.trim() : "";
      const priceRaw = i.price ?? i.priceRange ?? i.priceText;
      const price = priceRaw != null ? String(priceRaw).trim() : "";
      const moq = i.minOrder ?? i.minOrderQuantity ?? i.moq ?? i.minimumOrder;
      const snippet =
        [i.verifiedType, i.businessType, i.mainProducts]
          .filter(Boolean)
          .map((v) => String(v))
          .join(" · ") || (i.description ? String(i.description).trim() : "");
      return {
        name: store || String(i.title ?? i.name ?? "").trim(),
        url: String(i.url),
        snippet,
        price,
        orders: null,
        rating: typeof i.rating === "number" ? i.rating : null,
        source: "alibaba",
        store: store || undefined,
        minOrder: moq != null ? String(moq).trim() : undefined,
      } satisfies Supplier;
    });
}

// Made-in-China — B2B manufacturers with MOQs and certifications
// (agenscrape/made-in-china-com-product-scraper, cheapest at $1/1000).
export async function madeInChinaSuppliers(query: string, limit = 6): Promise<Supplier[]> {
  const items = await runActor(
    MADE_IN_CHINA_ACTOR,
    {
      searchMode: "keyword",
      keyword: query,
      maxResults: limit,
    },
    180_000
  );
  if (!items) return [];

  return items
    .map((i) => i as Record<string, unknown>)
    .filter((i) => (i?.title || i?.productName) && i?.url)
    .slice(0, limit)
    .map((i) => {
      const store = String(i.supplierName ?? i.companyName ?? i.supplier ?? "").trim();
      const priceRaw = i.price ?? i.unitPrice ?? i.priceText;
      const price = priceRaw != null ? String(priceRaw).trim() : "";
      const moq = i.minOrder ?? i.moq ?? i.minimumOrderQuantity;
      return {
        name: String(i.title ?? i.productName ?? "").trim(),
        url: String(i.url),
        snippet: i.description ? String(i.description).trim().slice(0, 120) : "",
        price,
        orders: null,
        rating: null,
        source: "made-in-china",
        store: store || undefined,
        minOrder: moq != null ? String(moq).trim() : undefined,
      } satisfies Supplier;
    });
}
