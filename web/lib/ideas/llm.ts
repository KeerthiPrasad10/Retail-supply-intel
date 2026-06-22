import "server-only";

import type { Classification, Competitor, DemandPulse, ProductIdea, ResearchResult } from "./types";

/* Claude agents — product classifier (vision-aware) and strategy analyst.
 *
 * Ported from SupplyScope's @anthropic-ai/sdk usage to a raw fetch against the
 * Anthropic Messages API, matching RSI's app/api/extract/route.ts (no extra
 * dependency). Structured output is obtained via a single forced tool call.
 *
 * Key resolution mirrors the rest of RSI's server routes:
 *   ANTHROPIC_API_KEY       preferred
 *   RSI_ANTHROPIC_API_KEY   fallback (same key the pipeline already uses)
 * With no key llmEnabled() is false and the pipeline degrades to demo data. */

export type CompetitiveAnalysis = {
  summary: string;
  positioning: string;
  differentiation: string[];
  risks: string[];
  suggestedPrice: string;
  nextSteps: string[];
};

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const API_URL = "https://api.anthropic.com/v1/messages";

function apiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || process.env.RSI_ANTHROPIC_API_KEY;
}

export function llmEnabled(): boolean {
  return Boolean(apiKey());
}

type ContentBlock = Record<string, unknown>;

// Call the Messages API with a forced single-tool call so the model returns a
// strictly-shaped JSON object (the tool's input). Returns null on any failure.
async function structuredCall<T>(
  content: ContentBlock[],
  toolName: string,
  schema: Record<string, unknown>,
  maxTokens: number
): Promise<T | null> {
  const key = apiKey();
  if (!key) return null;
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        tools: [{ name: toolName, description: "Return the requested structured result.", input_schema: schema }],
        tool_choice: { type: "tool", name: toolName },
        messages: [{ role: "user", content }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const block = (data.content as { type?: string; input?: unknown }[] | undefined)?.find(
      (b) => b.type === "tool_use"
    );
    if (!block?.input) return null;
    return block.input as T;
  } catch {
    return null;
  }
}

const CLASSIFICATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    category: {
      type: "string",
      enum: [
        "Apparel & Fashion",
        "Drinkware & Kitchen",
        "Home & Living",
        "Baby & Kids",
        "Beauty & Personal Care",
        "Sports & Outdoors",
        "Electronics & Accessories",
        "Pet Products",
        "Other",
      ],
      description: "The single closest broad product category from the allowed list; use 'Other' only if none fit.",
    },
    productClass: { type: "string", description: "Concise product class to search for to find similar products, e.g. 'insulated stainless steel water bottle'." },
    keywords: { type: "array", items: { type: "string" }, description: "3-6 search keywords for finding comparable products." },
    attributes: { type: "array", items: { type: "string" }, description: "Notable attributes/materials/features inferred." },
    summary: { type: "string", description: "One-line description of what the product is." },
  },
  required: ["category", "productClass", "keywords", "attributes", "summary"],
};

const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string", description: "2-3 sentence executive summary of the opportunity." },
    positioning: { type: "string", description: "How this product should be positioned against the market." },
    differentiation: { type: "array", items: { type: "string" }, description: "Concrete ways the product can stand out." },
    risks: { type: "array", items: { type: "string" }, description: "Key risks, gaps or concerns to watch." },
    suggestedPrice: { type: "string", description: "A specific recommended price or range, with currency." },
    nextSteps: { type: "array", items: { type: "string" }, description: "Recommended next actions for the team." },
  },
  required: ["summary", "positioning", "differentiation", "risks", "suggestedPrice", "nextSteps"],
};

function imageBlock(imageUrl: string): ContentBlock | null {
  if (!imageUrl) return null;
  const m = imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (m) return { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } };
  if (/^https?:\/\//.test(imageUrl)) return { type: "image", source: { type: "url", url: imageUrl } };
  return null;
}

export async function classifyProduct(idea: ProductIdea): Promise<Classification | null> {
  if (!llmEnabled()) return null;

  const content: ContentBlock[] = [];
  const img = imageBlock(idea.imageUrl);
  if (img) content.push(img);
  content.push({
    type: "text",
    text:
      "Classify this product idea for market research. Use the image if one is provided.\n" +
      `Title: ${idea.title}\n` +
      `Description: ${idea.description || "(none)"}\n` +
      `Stated category: ${idea.category || "(none)"}\n` +
      `Features: ${idea.features || "(none)"}\n\n` +
      "Pick the single closest category from the allowed list; use 'Other' only if none fit. " +
      "Return the category, a concise product class to search for, search keywords, key attributes, and a one-line summary.",
  });

  const parsed = await structuredCall<Classification>(content, "classify_product", CLASSIFICATION_SCHEMA, 1200);
  if (!parsed?.productClass) return null;
  return parsed;
}

const RELEVANCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    relevant: {
      type: "array",
      items: { type: "integer" },
      description:
        "Zero-based indices of ONLY the posts genuinely about this product, products like it, its product category, or real buyer interest/complaints/requests for it.",
    },
  },
  required: ["relevant"],
};

/**
 * Post-capture relevance judge for demand signals. Keyword matching can't tell
 * "rain jacket the product" from "rain in an owl fact" — so after fetching
 * candidate posts we ask Claude which are genuinely about the product and drop
 * the rest. Returns the indices to keep, or null when the LLM is unavailable /
 * fails (caller then keeps the keyword-filtered set).
 */
export async function filterRelevantDemandPosts(
  ctx: { title: string; productClass?: string; category?: string; description?: string },
  posts: { title: string; channel: string }[]
): Promise<number[] | null> {
  if (!llmEnabled() || posts.length === 0) return null;
  const list = posts.map((p, i) => `${i}. [${p.channel}] ${p.title}`).join("\n");
  const text = [
    "You curate a product's DEMAND-SIGNAL panel. Decide which community posts are genuinely relevant to the product below.",
    "",
    "PRODUCT",
    `Title: ${ctx.title}`,
    `Product class: ${ctx.productClass || ctx.category || "(unspecified)"}`,
    `Category: ${ctx.category || "(unspecified)"}`,
    ctx.description ? `Description: ${ctx.description}` : "",
    "",
    "CANDIDATE POSTS",
    list,
    "",
    "Keep ONLY posts that are actually about this product, products like it, its category, or real buyer interest/complaints/requests for it. " +
      "A post that merely shares a word (e.g. 'rain', 'waterproof', 'audio') but is really about an unrelated subject — animals, memes, software, news, jokes — is NOT relevant; exclude it. " +
      "Return the indices to keep; if none qualify, return an empty list.",
  ]
    .filter(Boolean)
    .join("\n");

  const parsed = await structuredCall<{ relevant: number[] }>(
    [{ type: "text", text }],
    "select_relevant_posts",
    RELEVANCE_SCHEMA,
    500
  );
  if (!parsed || !Array.isArray(parsed.relevant)) return null;
  return parsed.relevant.filter((n) => Number.isInteger(n) && n >= 0 && n < posts.length);
}

function buildAnalysisPrompt(
  idea: ProductIdea,
  competitors: Competitor[],
  priceRange: ResearchResult["benchmark"]["priceRange"],
  demand?: DemandPulse | null
): string {
  const compLines = competitors
    .map((c) => `- ${c.name} (${c.brand}) — ${c.price || "price n/a"} — ${c.features.join("; ") || "no features listed"}`)
    .join("\n");
  const range = priceRange
    ? `Market price range: ${priceRange.currency} ${Math.round(priceRange.min)}–${Math.round(priceRange.max)} (avg ${Math.round(priceRange.avg)}).`
    : "No reliable market pricing was extracted.";

  const demandLines =
    demand && demand.posts.length
      ? [
          "",
          "DEMAND SIGNALS (real community discussion, last 30 days — Reddit + Hacker News)",
          `Momentum: ${demand.momentum} · ${demand.totalPosts} posts · ${demand.totalEngagement.toLocaleString()} engagements across ${demand.channels.join(", ")}.`,
          ...demand.posts
            .slice(0, 8)
            .map((p) => `- [${p.channel}, ${p.engagement} eng] ${p.title}`),
          "Use these to gauge real demand, unmet needs, and language customers actually use. Call out momentum and any recurring complaints or requests.",
        ].join("\n")
      : "";

  return [
    "You are a product strategist helping a team evaluate a new product idea against the live market.",
    "",
    "PRODUCT IDEA",
    `Title: ${idea.title}`,
    `Description: ${idea.description || "(none)"}`,
    `Category: ${idea.category || "(unspecified)"}`,
    `Target market: ${idea.targetMarket || "(unspecified)"}`,
    `Target audience: ${idea.audience || "(unspecified)"}`,
    `Target price: ${idea.priceTarget || "(unspecified)"}`,
    `Key features: ${idea.features || "(none provided)"}`,
    "",
    "BENCHMARKED COMPETITORS (from live web research)",
    compLines || "(no comparable products were found)",
    range,
    demandLines,
    "",
    "Produce a concise, decision-useful competitive analysis. Reference specific competitors, pricing, and demand signals where relevant. Be concrete and avoid generic filler.",
  ].join("\n");
}

export async function analyzeWithClaude(
  idea: ProductIdea,
  competitors: Competitor[],
  priceRange: ResearchResult["benchmark"]["priceRange"],
  demand?: DemandPulse | null
): Promise<CompetitiveAnalysis | null> {
  if (!llmEnabled()) return null;
  const content: ContentBlock[] = [{ type: "text", text: buildAnalysisPrompt(idea, competitors, priceRange, demand) }];
  const parsed = await structuredCall<CompetitiveAnalysis>(content, "competitive_analysis", ANALYSIS_SCHEMA, 4000);
  if (!parsed?.summary || !Array.isArray(parsed.differentiation)) return null;
  return parsed;
}
