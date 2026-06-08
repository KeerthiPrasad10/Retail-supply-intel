export interface Country {
  code: string;
  name: string;
  region: string | null;
  lat: number | null;
  lon: number | null;
  is_origin: boolean;
}

export interface Category {
  id: number;
  name: string;
  hs_code: string | null;
}

export interface TrendRow {
  term: string;
  platform: string;
  category_id: number | null;
  category: string | null;
  country_code: string | null;
  country: string;
  momentum: number;
  growth: number;
  volume: number;
  acceleration: number;
  rank: number | null;
}

export interface SourceEntry {
  partner_code: string;
  value: number;
  share: number;
  growth: number;
  emerging: boolean;
}

/** One Asian-origin → buyer-market trade edge (latest period). */
export interface Flow {
  market_code: string;
  market: string;
  origin_code: string;
  origin: string;
  category_id: number | null;
  category: string | null;
  value: number;
  period: string;
  growth: number;
  emerging: boolean;
}

export interface CompetitorSourcingLink {
  category_id: number | null;
  category: string | null;
  partner_code: string | null;
  partner: string | null;
  source: string | null;
}

export interface Competitor {
  id: number;
  name: string;
  home_country: string | null;
  home_market: string | null;
  sourcing: CompetitorSourcingLink[];
}

export interface Supplier {
  id: number;
  name: string;
  country_code: string | null;
  country: string | null;
  category_id: number | null;
  category: string | null;
  source: string | null;
}

export interface LeadingIndicator {
  term: string;
  platform: string;
  category_id: number | null;
  category: string | null;
  country_code: string | null;
  country: string;
  acceleration: number;
  momentum: number;
  growth: number;
  volume: number;
}

export interface Trigger {
  id: number;
  score: number;
  market_code: string | null;
  market: string;
  category_id: number | null;
  category: string | null;
  focus_partner: string | null;
  focus_partner_name: string | null;
  rationale: string;
  status: string;
  created_at: string | null;
  payload: {
    top_sources?: SourceEntry[];
    emerging_suppliers?: SourceEntry[];
    competitors?: string[];
    demand_momentum?: number;
    demand_growth?: number;
  };
}

export interface Snapshot {
  generated_at: string;
  countries: Country[];
  categories: Category[];
  trends: TrendRow[];
  sources: Record<string, SourceEntry[]>;
  triggers: Trigger[];
  flows: Flow[];
  competitors: Competitor[];
  suppliers: Supplier[];
  leading_indicators: LeadingIndicator[];
}
