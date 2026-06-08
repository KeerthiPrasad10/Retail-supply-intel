# Market Intelligence — Lidl/Kaufland Asia (LKA) sourcing lens

**Status:** approved (best-effort supplier strategy)
**Date:** 2026-06-08

## Goal

Turn Retail Supply Intel into a market-intelligence view for the **LKA (Lidl
Kaufland Asia)** sourcing team: for Lidl's top competitors and the top product
categories, show what's trending, which **Asian** origins supply each category,
trace those supply chains onto a map, expose per-country export flows into each
competitor's market, and surface **leading indicators** of what will trend next.

## Audience framing

LKA sources private-label / non-food goods from **Asian** manufacturers for Lidl
and Kaufland. So the supply-chain lens is **Asian exporters → European retail
markets (ours + competitors')**. Origins are the seeded Asian countries (CN, VN,
IN, BD, ID, TH, KH, PK, TR, JP, KR).

## Scope

In:
- Top-10 Lidl competitors (retailers) as `competitors` reference data.
- Top-10 trend-relevant private-label categories (reuse the seeded 11, trim to 10).
- Demand trends per category/market (Wikipedia pageviews + Google Trends).
- Supply chains: Asian origin → buyer market, country-level, via UN Comtrade
  **both flows** (imports into markets *and* exports from Asian origins to each
  competitor market).
- Map view (Asia → Europe flows) with category/competitor filters.
- Leading-indicator score (acceleration / early-rise) → "about to trend" board.
- Best-effort named Asian suppliers per category (web research), **labeled
  unverified**.

Out (needs paid bill-of-lading data, deferred):
- Verified per-company/per-shipment competitor sourcing (Panjiva/ImportGenius).
  `competitor_sourcing` is populated best-effort only and flagged as such.

## Data feasibility (explicit)

| Question | Source | Granularity |
|---|---|---|
| What's trending | Wikipedia + Google Trends | category × country |
| Which Asian countries supply a category | Comtrade imports (flow=M) | country |
| What each Asian country exports to a competitor market | Comtrade exports (flow=X) | country |
| Named Asian supplier behind a flow | Web research (Exa/Bright Data) | best-effort, unverified |
| Verified competitor↔supplier shipments | — | OUT (needs paid BoL) |

## Phases (each shippable)

- **A — Data & reference (backend).** Seed `competitors`; add export-side Comtrade
  querying (Asian reporter → competitor-market partner); add leading-indicator
  scoring; best-effort supplier research → `suppliers` (+ tentative
  `competitor_sourcing`); run pipeline against Supabase; export enriched
  `snapshot.json`.
- **B — Map (frontend).** `/map` route: world (Asia-centered) choropleth of origin
  intensity + origin→market flow lines, filter by category & competitor.
  `react-simple-maps` + a free topojson world atlas (no API token).
- **C — Competitor & supplier intelligence.** Per-competitor profile: categories,
  origin mix, export flows into its market, best-effort suppliers (labeled).
- **D — "About to trend".** Leading-indicator board per category/market on Phase A
  data.

## Data model changes (models.py is source of truth)

- `competitors`: seed top-10 (name, home_country).
- `trade_flows`: now also stores `flow='export'` rows (reporter = Asian origin,
  partner = buyer market). Existing unique constraint already covers this.
- `suppliers`: best-effort rows (name, country_code, category_id, source='research').
- `competitor_sourcing`: tentative links (signal + source='research'), nullable
  supplier_id; UI labels these "unverified".
- `trend_scores`: add `acceleration` (growth-of-growth) — the leading indicator.
  (Schema change → regenerate migration `0002_*`.)

## Leading indicator

`acceleration` = change in growth_rate between the latest window and the prior
window on a demand series. High positive acceleration on a still-modest volume =
"early / about to trend". Surfaced as a ranked board and a badge on triggers.

## Map approach

`react-simple-maps` (SVG, declarative, free). World atlas topojson bundled
locally. Markers/choropleth on Asian origins sized by export value; animated
flow lines from origin centroid → buyer-market centroid. Centroids stored in
reference data. No Mapbox token needed.

## Best-effort supplier research

A new connector `connectors/suppliers_research.py` uses the available web tools
(Exa search / Bright Data) to find prominent Asian manufacturers/exporters per
category, writing `suppliers` rows with `source='research'`. Every researched
row is visually flagged in the UI as "researched, not customs-verified".

## Testing

- Unit: export-flow parsing, acceleration math (extend `tests/`).
- Pipeline: `rsi run` against SQLite locally, then Supabase.
- Web: build + typecheck; map route renders with snapshot data.

## Out of scope / future

Paid BoL integration, supplier entity resolution, alerting, multi-tenant.
