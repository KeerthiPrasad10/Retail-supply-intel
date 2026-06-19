/* Types for the "Validate" feature — submit a product idea, then run a
 * multi-agent research & benchmark pass. Ported from SupplyScope; namespaced
 * under lib/ideas/ so it never collides with the dashboard view-model types. */

export type IdeaStatus = "queued" | "researching" | "complete" | "error";

export type ProductIdea = {
  id: string;
  createdAt: string;
  title: string;
  description: string;
  category: string;
  targetMarket: string;
  audience: string;
  priceTarget: string;
  features: string;
  imageUrl: string;
  submittedBy: string;
  status: IdeaStatus;
  research?: ResearchResult;
};

export type Competitor = {
  name: string;
  brand: string;
  price: string;
  priceValue: number | null;
  currency: string;
  features: string[];
  url: string;
  source: string;
  rating?: number | null;
  reviews?: number | null;
};

export type AgentRunInfo = {
  id: string;
  name: string;
  description: string;
  status: "complete" | "error" | "skipped";
  detail: string;
};

export type Classification = {
  category: string;
  productClass: string;
  keywords: string[];
  attributes: string[];
  summary: string;
};

export type Supplier = {
  name: string;
  url: string;
  snippet: string;
  price?: string;
  orders?: number | null;
  rating?: number | null;
  source?: string;
  /** The seller/store or manufacturer behind the listing (when available). */
  store?: string;
  /** Minimum order quantity, e.g. "100 pieces" (Alibaba / B2B). */
  minOrder?: string;
};

export type Maker = {
  name: string;
  offers: number;
  lowestPrice: string;
};

export type DemandPost = {
  title: string;
  url: string;
  source: "reddit" | "hackernews";
  channel: string;
  engagement: number;
  comments: number;
  createdAt: string;
};

export type DemandPulse = {
  posts: DemandPost[];
  totalPosts: number;
  totalEngagement: number;
  channels: string[];
  momentum: "high" | "moderate" | "low" | "quiet";
};

export type ResearchResult = {
  mode: "live" | "demo";
  ranAt: string;
  durationMs: number;
  enrichment: {
    suggestedCategory: string;
    tags: string[];
    targetAudience: string;
    summary: string;
  };
  benchmark: {
    competitors: Competitor[];
    priceRange: { min: number; max: number; avg: number; currency: string } | null;
    insights: string[];
  };
  classification?: Classification | null;
  suppliers?: Supplier[];
  makers?: Maker[];
  demand?: DemandPulse | null;
  renderings?: Rendering[];
  analysis?: {
    summary: string;
    positioning: string;
    differentiation: string[];
    risks: string[];
    suggestedPrice: string;
    nextSteps: string[];
  } | null;
  agents: AgentRunInfo[];
  sources: { title: string; url: string }[];
  error?: string;
};

export type Rendering = {
  url: string;
  scene: "shelf" | "lifestyle" | "hero";
  width: number;
  height: number;
};

export type NewIdeaInput = {
  title: string;
  description?: string;
  category?: string;
  targetMarket?: string;
  audience?: string;
  priceTarget?: string;
  features?: string;
  imageUrl?: string;
  submittedBy?: string;
};
