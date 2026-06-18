/* View-model types for the NxB Sourcing dashboard. */

export type View =
  | "overview"
  | "insights"
  | "trending"
  | "deepdive"
  | "map"
  | "suppliers"
  | "shortlist"
  | "ideas";
export type Go = (view: View, id?: string | null) => void;

export type InsightAction = "PROCURE" | "WATCH" | "HOLD";

export interface InsightEvidence {
  category?: string;
  market?: string;
  demand?: { platform: string; momentum: number; growth: number; acceleration: number }[];
  rising_sources?: number;
  total_sources?: number;
  max_acceleration?: number;
  top_origins?: { origin: string; share: number; growth: number; emerging: boolean }[];
  recommended_origins?: string[];
  marketplace?: { platform: string; momentum: number; growth: number; acceleration: number }[];
  competitors?: { competitor: string; origin: string }[];
}

/** A procurement recommendation produced by the orchestrator. */
export interface Insight {
  id: number;
  category: string | null;
  market: string;
  action: InsightAction;
  score: number;
  confidence: number;
  headline: string;
  narrative: string;
  narrator: string;
  evidence: InsightEvidence;
}

/** [countryCode, share (0..1), growth (fraction), emerging? (1)] */
export type Source = [string, number, number] | [string, number, number, number];

export type Tier = "SURGING" | "RISING" | "WATCH";

export type SourceKind = "demand" | "supply";
/** ok = produced rows · empty = ran, no new data · error = run failed ·
 *  idle = no recorded run (e.g. an opt-in feed that hasn't been ingested). */
export type SourceState = "ok" | "empty" | "error" | "idle";

/** A signal feed (ingestion connector) and its last-run telemetry. */
export interface SignalSource {
  name: string;
  label: string;
  kind: SourceKind;
  isDefault: boolean;
  lastRunAt: string | null;
  status: SourceState;
  rows: number;
}

export interface TrendCompetitor {
  name: string;
  note: string;
}

/** Structured opportunity summary: what changed, why, and the impact. */
export interface TrendSummary {
  change: string;
  why: string;
  impact: string;
}

export interface Trend {
  id: string;
  cat: string;
  market: string;
  marketCode: string | null;
  momentum: number;
  growth: number;
  score: number; // 0..100 opportunity score
  tier: Tier;
  focus: string | null;
  /** true only when `focus` is a genuine emerging origin (gaining share, distinct
   *  from the incumbent leader) — drives whether the "source from X" framing applies. */
  focusEmerging: boolean;
  sources: Source[];
  emerging: Source[];
  competitors: TrendCompetitor[];
  summary: TrendSummary;
}

export interface Supplier {
  id: string;
  name: string;
  cc: string;
  cats: string[];
  match: number;
  certs: string[];
  moq: string;
  lead: string;
  capacity: string;
  price: number;
  est: number;
  verified: boolean;
  note: string;
}

export interface SupplierMatch extends Supplier {
  onTrendOrigin: boolean;
  isEmerging: boolean;
}

export interface Model {
  generatedAt: string;
  snapshotLabel: string;
  trends: Trend[];
  nameByCode: Record<string, string>;
  geo: Record<string, [number, number]>; // [lat, lon]
  regionByCode: Record<string, string>;
  hsByCat: Record<string, string>;
  emergingOriginCount: number;
  surgingCount: number;
  topSurge: string | null;
  insights: Insight[];
  procureCount: number;
  signalSources: SignalSource[];
}

/* ---- minimal shape of web/lib/snapshot.json (pipeline export) ---- */
export interface SnapSourceEntry {
  partner_code: string;
  value: number;
  share: number;
  growth: number;
  emerging: boolean;
}
export interface SnapTrigger {
  id: number;
  score: number;
  market_code: string | null;
  market: string;
  category_id: number | null;
  category: string | null;
  focus_partner: string | null;
  focus_partner_name: string | null;
  rationale: string;
  payload: {
    top_sources?: SnapSourceEntry[];
    emerging_suppliers?: SnapSourceEntry[];
    competitors?: string[];
    demand_momentum?: number;
    demand_growth?: number;
  };
}
export interface SnapCountry {
  code: string;
  name: string;
  region: string | null;
  lat?: number;
  lon?: number;
}
export interface SnapCategory {
  id: number;
  name: string;
  hs_code: string | null;
}
export interface SnapCompetitor {
  id: number;
  name: string;
  home_country: string | null;
  home_market?: string | null;
  sourcing?: { category_id: number | null; category: string | null; partner: string | null }[];
}
export interface SnapSignalSource {
  name: string;
  label: string;
  kind: SourceKind;
  default: boolean;
  last_run_at: string | null;
  status: SourceState;
  rows: number;
}
export interface Snapshot {
  generated_at: string;
  countries: SnapCountry[];
  categories: SnapCategory[];
  triggers: SnapTrigger[];
  competitors?: SnapCompetitor[];
  insights?: Insight[];
  signal_sources?: SnapSignalSource[];
}
