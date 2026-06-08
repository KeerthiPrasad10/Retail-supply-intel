export interface Country {
  code: string;
  name: string;
  region: string | null;
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
  rank: number | null;
}

export interface SourceEntry {
  partner_code: string;
  value: number;
  share: number;
  growth: number;
  emerging: boolean;
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
}
