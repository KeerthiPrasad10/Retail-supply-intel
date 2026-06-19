import "server-only";

import type {
  AgentRunInfo,
  Classification,
  Competitor,
  Maker,
  ProductIdea,
  ResearchResult,
  Supplier,
} from "./types";
import { extractProduct, firecrawlEnabled, search, type SearchResult } from "./firecrawl";
import { amazonSearch, aliexpressSuppliers, alibabaSuppliers, madeInChinaSuppliers, apifyEnabled } from "./apify";
import { demandPulse } from "./demand";
import { analyzeWithClaude, classifyProduct, llmEnabled } from "./llm";
import { generateRenderings, falEnabled } from "./renderings";
import { parsePrice, priceRangeOf } from "./price";
import { updateIdea } from "./store";

function demandAgentInfo(demand: Awaited<ReturnType<typeof demandPulse>>): AgentRunInfo {
  return {
    id: "demand",
    name: "Demand Signals (Reddit + HN)",
    description: "Reads real community discussion from the last 30 days.",
    status: demand.totalPosts ? "complete" : "error",
    detail: demand.totalPosts
      ? `${demand.totalPosts} posts · ${demand.totalEngagement.toLocaleString()} engagements · ${demand.momentum} momentum.`
      : "No recent community discussion found.",
  };
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "with", "without", "of", "to", "in",
  "on", "by", "your", "our", "that", "this", "is", "are", "be", "new", "made",
  "from", "into", "product", "products", "design", "designed", "high", "best",
]);

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function keywords(...parts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts.join(" ").toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    if (p.length < 3 || STOPWORDS.has(p) || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
    if (out.length >= 8) break;
  }
  return out;
}

function uniqueByDomain(results: SearchResult[], max: number): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const r of results) {
    const d = domainOf(r.url);
    if (seen.has(d)) continue;
    seen.add(d);
    out.push(r);
    if (out.length >= max) break;
  }
  return out;
}

function buildMakers(competitors: Competitor[]): Maker[] {
  const map = new Map<string, { name: string; low: number | null; currency: string; count: number }>();
  competitors.forEach((c) => {
    if (!c.brand || c.brand.includes(".") || c.brand.length < 2) return;
    const key = c.brand.toLowerCase();
    const e = map.get(key) ?? { name: c.brand, low: null, currency: c.currency || "", count: 0 };
    e.count += 1;
    if (c.priceValue != null && (e.low == null || c.priceValue < e.low)) {
      e.low = c.priceValue;
      e.currency = c.currency || e.currency;
    }
    map.set(key, e);
  });
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 9)
    .map((m) => ({
      name: m.name,
      offers: m.count,
      lowestPrice: m.low != null ? `${m.currency === "USD" || !m.currency ? "$" : m.currency + " "}${Math.round(m.low)}` : "",
    }));
}

function buildInsights(
  idea: ProductIdea,
  competitors: Competitor[],
  suppliers: Supplier[],
  priceRange: ResearchResult["benchmark"]["priceRange"]
): string[] {
  const insights: string[] = [];
  if (competitors.length) insights.push(`Benchmarked ${competitors.length} comparable products across online stores and the web.`);
  if (priceRange) {
    const fmt = (n: number) => `${priceRange.currency === "USD" ? "$" : (priceRange.currency || "$") + " "}${Math.round(n)}`;
    insights.push(`Retail pricing ranges from ${fmt(priceRange.min)} to ${fmt(priceRange.max)} (avg ~${fmt(priceRange.avg)}).`);
    const target = parsePrice(idea.priceTarget).value;
    if (target != null) {
      if (target < priceRange.min) insights.push(`Your ${fmt(target)} target undercuts every product found — a potential value play.`);
      else if (target > priceRange.max) insights.push(`Your ${fmt(target)} target sits above the market — lean into premium positioning.`);
      else insights.push(`Your ${fmt(target)} target lands mid-market — differentiation on features will matter.`);
    }
  }
  const ali = suppliers.filter((s) => s.source === "aliexpress" && s.price);
  if (ali.length) {
    const lows = ali.map((s) => parsePrice(s.price).value).filter((v): v is number => v != null);
    if (lows.length) insights.push(`China suppliers list from ~$${Math.round(Math.min(...lows))}, suggesting healthy gross margin at retail prices.`);
  }
  if (insights.length < 2) insights.push("Use the benchmark below to position pricing, features and messaging before committing to development.");
  return insights;
}

function buildEnrichment(idea: ProductIdea, competitors: Competitor[], classification: Classification | null) {
  const tags = classification?.keywords?.length ? classification.keywords.slice(0, 8) : keywords(idea.title, idea.features, idea.category);
  const baseSummary = classification?.summary ? classification.summary : (idea.description ? idea.description.slice(0, 160) : "No description provided.");
  return {
    suggestedCategory: classification?.category || idea.category || "Uncategorised",
    tags,
    targetAudience: idea.audience || idea.targetMarket || "General consumers",
    summary: `${baseSummary} Benchmarked against ${competitors.length} product${competitors.length === 1 ? "" : "s"}.`,
  };
}

async function benchmarkViaFirecrawl(query: string): Promise<{ competitors: Competitor[]; sources: { title: string; url: string }[]; found: number }> {
  const results = await search(query, 8);
  const candidates = uniqueByDomain(results, 4).slice(0, 3);
  const extractions = await Promise.allSettled(candidates.map((c) => extractProduct(c.url)));

  const competitors: Competitor[] = candidates.map((cand, i) => {
    const res = extractions[i];
    const data = res.status === "fulfilled" ? res.value : null;
    const priced = parsePrice(data?.price);
    return {
      name: data?.productName?.trim() || cand.title.replace(/\s*[-|–].*$/, "").trim(),
      brand: data?.brand?.trim() || domainOf(cand.url),
      price: data?.price?.trim() || "",
      priceValue: priced.value,
      currency: priced.currency,
      features: (data?.keyFeatures ?? []).slice(0, 5).map((f) => String(f).trim()).filter(Boolean),
      url: cand.url,
      source: domainOf(cand.url),
      rating: null,
      reviews: null,
    };
  });

  return {
    competitors,
    sources: results.slice(0, 8).map((r) => ({ title: r.title, url: r.url })),
    found: results.length,
  };
}

async function findWebSuppliers(productClass: string): Promise<Supplier[]> {
  const results = await search(`${productClass} manufacturer supplier wholesale OEM`, 6);
  return uniqueByDomain(results, 5)
    .slice(0, 5)
    .map((r) => ({ name: r.title.replace(/\s*[-|–].*$/, "").trim(), url: r.url, snippet: r.description, source: "web" }));
}

function dedupeCompetitors(rows: Competitor[]): Competitor[] {
  const seen = new Set<string>();
  return rows.filter((c) => {
    const key = c.name.toLowerCase().slice(0, 40);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeSuppliers(rows: Supplier[]): Supplier[] {
  const seen = new Set<string>();
  return rows.filter((s) => {
    const key = (s.url || s.name).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function runDemo(idea: ProductIdea, started: number): Promise<ResearchResult> {
  // Demand signals are key-free, so fetch real ones even in demo mode.
  const demand = await demandPulse(idea.category || idea.title);
  const base = 25 + (idea.title.length % 7) * 6;
  const competitors: Competitor[] = [
    { name: `${idea.category || "Market"} Leader Pro`, brand: "Northwind", price: `$${base + 20}`, priceValue: base + 20, currency: "USD", features: ["Premium materials", "2-year warranty"], url: "https://example.com/a", source: "example.com", rating: 4.6, reviews: 1200 },
    { name: `Everyday ${idea.category || "Product"}`, brand: "Brightway", price: `$${base}`, priceValue: base, currency: "USD", features: ["Affordable", "Lightweight"], url: "https://example.com/b", source: "example.com", rating: 4.2, reviews: 430 },
    { name: `${idea.title} Alternative`, brand: "Marisol", price: `$${base + 10}`, priceValue: base + 10, currency: "USD", features: ["Compact"], url: "https://example.com/c", source: "example.com", rating: 4.4, reviews: 90 },
  ];
  const priceRange = priceRangeOf(competitors);
  return {
    mode: "demo",
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    enrichment: buildEnrichment(idea, competitors, null),
    benchmark: { competitors, priceRange, insights: buildInsights(idea, competitors, [], priceRange) },
    makers: buildMakers(competitors),
    suppliers: [],
    demand,
    agents: [
      { id: "amazon", name: "Online Stores", description: "Scans Amazon for live listings.", status: "skipped", detail: "Demo mode — set APIFY_API_TOKEN for live store data." },
      { id: "benchmark", name: "Benchmarking", description: "Builds the competitor benchmark.", status: "complete", detail: "Generated sample benchmark data." },
      demandAgentInfo(demand),
    ],
    sources: [],
  };
}

export async function runResearch(idea: ProductIdea): Promise<ResearchResult> {
  const started = Date.now();

  if (!firecrawlEnabled() && !apifyEnabled() && !llmEnabled()) {
    return await runDemo(idea, started);
  }

  const agents: AgentRunInfo[] = [];

  // 1. Classify (Claude, vision-aware) — drives search terms.
  let classification: Classification | null = null;
  if (llmEnabled()) {
    classification = await classifyProduct(idea);
    agents.push({
      id: "classifier",
      name: "Classifier",
      description: "Classifies the product and derives search terms.",
      status: classification ? "complete" : "error",
      detail: classification ? `Class: ${classification.productClass} · ${classification.keywords.length} keywords.` : "Could not classify.",
    });
  }
  // Reflect the classified category onto the idea so the board and detail stay
  // consistent, and persist best-effort (non-fatal).
  let workingIdea = idea;
  if (classification?.category && classification.category !== "Other") {
    workingIdea = { ...idea, category: classification.category };
    await updateIdea(idea.id, { category: classification.category }).catch(() => {});
  }

  const productClass = classification?.productClass || workingIdea.category || workingIdea.title;
  const webQuery =
    (classification?.keywords?.length ? classification.keywords.join(" ") : `${workingIdea.title} ${workingIdea.category}`.trim()) +
    " similar products";

  // 2. Run sources in parallel: Amazon (stores), Firecrawl (web), AliExpress
  // (China suppliers), Firecrawl (web suppliers), and the demand pulse
  // (Reddit + HN — key-free, so it always runs).
  const [amazon, benchRes, aliexpress, alibaba, madeInChina, webSuppliers, demand] = await Promise.all([
    apifyEnabled() ? amazonSearch(productClass, 8) : Promise.resolve<Competitor[]>([]),
    firecrawlEnabled() ? benchmarkViaFirecrawl(webQuery) : Promise.resolve(null),
    apifyEnabled() ? aliexpressSuppliers(productClass, 8) : Promise.resolve<Supplier[]>([]),
    apifyEnabled() ? alibabaSuppliers(productClass, 6) : Promise.resolve<Supplier[]>([]),
    apifyEnabled() ? madeInChinaSuppliers(productClass, 6) : Promise.resolve<Supplier[]>([]),
    firecrawlEnabled() ? findWebSuppliers(productClass) : Promise.resolve<Supplier[]>([]),
    demandPulse(productClass),
  ]);
  agents.push(demandAgentInfo(demand));

  if (apifyEnabled()) {
    agents.push({
      id: "amazon",
      name: "Online Stores (Amazon)",
      description: "Pulls live Amazon listings: brands, prices, ratings.",
      status: amazon.length ? "complete" : "error",
      detail: amazon.length ? `Found ${amazon.length} Amazon listings.` : "No Amazon listings found.",
    });
  }
  if (firecrawlEnabled()) {
    const fc = benchRes?.competitors ?? [];
    agents.push({
      id: "web",
      name: "Web Research (Firecrawl)",
      description: "Finds and extracts similar products across the web.",
      status: benchRes && benchRes.found ? "complete" : "error",
      detail: benchRes ? `Found ${benchRes.found} web sources · benchmarked ${fc.length}.` : "No web results.",
    });
  }
  if (apifyEnabled()) {
    agents.push({
      id: "aliexpress",
      name: "AliExpress Sellers",
      description: "Finds China sellers with store names and order counts.",
      status: aliexpress.length ? "complete" : "error",
      detail: aliexpress.length ? `Found ${aliexpress.length} AliExpress sellers.` : "No AliExpress results.",
    });
    agents.push({
      id: "alibaba",
      name: "Alibaba Manufacturers",
      description: "Finds verified B2B manufacturers with MOQs.",
      status: alibaba.length ? "complete" : "error",
      detail: alibaba.length ? `Found ${alibaba.length} Alibaba manufacturers.` : "No Alibaba results.",
    });
    agents.push({
      id: "made-in-china",
      name: "Made-in-China",
      description: "B2B factory listings with MOQs and certifications.",
      status: madeInChina.length ? "complete" : "error",
      detail: madeInChina.length ? `Found ${madeInChina.length} manufacturers.` : "No Made-in-China results.",
    });
  }
  if (firecrawlEnabled()) {
    agents.push({
      id: "web-suppliers",
      name: "Web Sourcing (Firecrawl)",
      description: "Finds manufacturers and suppliers on the web.",
      status: webSuppliers.length ? "complete" : "error",
      detail: webSuppliers.length ? `Found ${webSuppliers.length} supplier leads.` : "No suppliers found.",
    });
  }

  // Combine sources.
  const competitors = dedupeCompetitors([...amazon, ...(benchRes?.competitors ?? [])]).slice(0, 12);
  // Alibaba + MadeInChina first (real manufacturers), then AliExpress (sellers), then web.
  const suppliers = dedupeSuppliers([...alibaba, ...madeInChina, ...aliexpress, ...webSuppliers]).slice(0, 12);
  const sources = benchRes?.sources ?? [];

  const priceRange = priceRangeOf(competitors);
  const makers = buildMakers(competitors);
  const insights = buildInsights(workingIdea, competitors, suppliers, priceRange);
  const enrichment = buildEnrichment(workingIdea, competitors, classification);

  if (!competitors.length && !suppliers.length && !classification) {
    return await runDemo(idea, started);
  }

  const { renderings, error: renderError } = await generateRenderings(workingIdea);
  const hasRealImage = Boolean(workingIdea.imageUrl && workingIdea.imageUrl.startsWith("http"));
  agents.push({
    id: "renderings",
    name: "Product Renderings (fal.ai)",
    description: "Generates AI placement scenes from the product image.",
    status: falEnabled() && hasRealImage ? (renderings.length ? "complete" : "error") : "skipped",
    detail: falEnabled() && hasRealImage
      ? renderings.length
        ? `Generated ${renderings.length} placement rendering${renderings.length === 1 ? "" : "s"}.`
        : `Rendering failed${renderError ? ` — ${renderError}` : "."}`
      : falEnabled() && !hasRealImage
        ? "Skipped — upload a product photo (needs a public image URL)."
        : "Skipped — set FAL_KEY to enable placement renderings.",
  });

  const result: ResearchResult = {
    mode: "live",
    ranAt: new Date().toISOString(),
    durationMs: 0,
    enrichment,
    classification,
    benchmark: { competitors, priceRange, insights },
    suppliers,
    makers,
    demand,
    renderings,
    agents,
    sources,
  };

  // Strategy analyst (Claude) — reasons over the combined benchmark.
  if (llmEnabled()) {
    const analysis = await analyzeWithClaude(workingIdea, competitors, priceRange, demand);
    if (analysis) {
      result.analysis = analysis;
      agents.push({
        id: "analyst",
        name: "Strategy Analyst",
        description: "Turns the research into positioning, pricing and next steps.",
        status: "complete",
        detail: `Produced positioning, ${analysis.differentiation.length} differentiators and ${analysis.nextSteps.length} next steps.`,
      });
    } else {
      agents.push({
        id: "analyst",
        name: "Strategy Analyst",
        description: "Turns the research into positioning, pricing and next steps.",
        status: "error",
        detail: "Analysis could not be generated.",
      });
    }
  }

  result.durationMs = Date.now() - started;
  return result;
}
