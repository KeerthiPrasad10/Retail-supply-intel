import "server-only";

/* Firecrawl agent — web search + per-page product extraction for the benchmark.
 * Degrades gracefully: with no FIRECRAWL_API_KEY every call returns empty. */

const BASE = "https://api.firecrawl.dev/v2";

export type SearchResult = { title: string; url: string; description: string };

export type ExtractedProduct = {
  productName?: string;
  brand?: string;
  price?: string;
  keyFeatures?: string[];
  summary?: string;
};

export function firecrawlEnabled(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY);
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
    "Content-Type": "application/json",
  };
}

async function postJSON(path: string, body: unknown, timeoutMs: number): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function search(query: string, limit = 6): Promise<SearchResult[]> {
  const data = (await postJSON("/search", { query, limit, sources: ["web"] }, 30_000)) as
    | { data?: { web?: unknown[] } | unknown[] }
    | null;
  const dataField = data?.data as { web?: unknown[] } | unknown[] | undefined;
  const web = Array.isArray(dataField)
    ? dataField
    : ((dataField as { web?: unknown[] })?.web ?? []);
  if (!Array.isArray(web)) return [];
  return web
    .map((r) => r as Record<string, unknown>)
    .filter((r) => r?.url)
    .map((r) => ({
      title: String(r.title ?? r.url),
      url: String(r.url),
      description: String(r.description ?? ""),
    }));
}

export async function extractProduct(url: string): Promise<ExtractedProduct | null> {
  const data = (await postJSON(
    "/scrape",
    {
      url,
      onlyMainContent: true,
      timeout: 45_000,
      formats: [
        {
          type: "json",
          prompt:
            "Extract details about the single main product on this page for competitive benchmarking. If this is a category/listing page, use the first or most prominent product.",
          schema: {
            type: "object",
            properties: {
              productName: { type: "string" },
              brand: { type: "string" },
              price: { type: "string", description: "Include currency symbol/code, e.g. $42.95 USD" },
              keyFeatures: { type: "array", items: { type: "string" } },
              summary: { type: "string", description: "One concise sentence about the product" },
            },
          },
        },
      ],
    },
    55_000
  )) as { data?: { json?: unknown } } | null;
  const json = data?.data?.json;
  if (!json || typeof json !== "object") return null;
  return json as ExtractedProduct;
}
