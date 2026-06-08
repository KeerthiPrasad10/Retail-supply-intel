# Architecture

Retail Supply Intel connects **two signal worlds** and finds the bridges between
them:

- **Demand signals** — what consumers are *about* to want, from social/search
  momentum (currently Google Trends + Wikipedia pageviews; TikTok / Instagram /
  Pinterest are Phase-2 connectors).
- **Supply signals** — where goods actually come from, from international trade
  flows (UN Comtrade) and, later, per-company bill-of-lading data.

The product's value is the **correlation layer**: a rising trend in a market is
mapped to a product category, then to the countries that category is sourced
from — surfacing *emerging* origins and the competitors already buying there, as
ranked, explainable **triggers**.

```
 DEMAND                                            SUPPLY
 ─────────────────────────────                     ──────────────────────────
 google_trends ┐                                   comtrade ┐
 wikipedia     ├─► trend_observations               (HS4)   ├─► trade_flows
 (tiktok…)     ┘          │                                  ┘        │
                          ▼                                           │
                    trend_scores  ── momentum, growth ──┐             │
                                                         ▼             ▼
                                              ┌──────────────────────────────┐
                                              │   correlation engine          │
                                              │  trend → category → origins   │
                                              │  → emerging? → competitors?   │
                                              └──────────────┬───────────────┘
                                                             ▼
                                                         triggers
                                                             ▼
                                            snapshot.json ──► Next.js dashboard
                                            (or live Supabase queries, Phase 2)
```

## Components

| Path                       | Role |
|----------------------------|------|
| `pipelines/`               | Python (uv). Connectors, scoring, correlation, CLI. |
| `pipelines/src/rsi/models.py` | SQLAlchemy ORM — **single source of truth** for the schema. |
| `pipelines/src/rsi/connectors/` | One module per data source; all degrade gracefully. |
| `supabase/migrations/`     | Postgres DDL, *generated* from the models. |
| `web/`                     | Next.js + Tailwind dashboard. |
| `web/lib/snapshot.json`    | Read-optimised export the dashboard renders (MVP data path). |

## Data model

Four layers (see `models.py` / `supabase/migrations/0001_initial_schema.sql`):

- **Reference** — `countries`, `product_categories`. A category carries an
  **HS4 code** (the join key between social trends and customs data) and the
  `keywords` used to map free-text trends onto it.
- **Demand** — `trends` (a term on a platform) → `trend_observations` (a value
  in a country at a time) → `trend_scores` (per-(trend, country) momentum,
  recomputed each run).
- **Supply** — `trade_flows` (reporter imports category from a **partner** =
  country of origin), plus `suppliers`, `competitors`, `competitor_sourcing`
  (the Phase-2 hook for per-company import data).
- **Output** — `triggers` (ranked, explainable correlation results with a JSON
  `payload`).

## Pipeline stages

1. **Ingest** (`rsi ingest`) — connectors fetch from free sources and write
   observations / trade flows. Network failures and rate limits never abort a
   run (each connector swallows errors and returns a partial count).
2. **Score** (`rsi score`) — `series_momentum` compares a recent window against
   the prior one to get growth, then weights it by `log1p(volume)` so spikes on
   tiny baselines don't outrank real, high-volume surges. Ranks within each
   country.
3. **Correlate** (`rsi correlate`) — for each rising (trend, country) with a
   category, `category_sources` aggregates trade flows by origin to get share +
   YoY growth, flags **emerging** origins (≥15% growth or newly appearing),
   joins any competitor sourcing, and emits a `Trigger`. Re-runs replace only
   `status='new'` triggers so human triage survives.
4. **Export** (`rsi export`) — writes `web/lib/snapshot.json`.

## Storage strategy

The SQLAlchemy models run unchanged on **SQLite** (zero-config local dev,
`data/rsi.db`) and **Postgres/Supabase** (set `RSI_DATABASE_URL`). The dashboard
reads the committed snapshot today; when Supabase is provisioned, `web/lib/data.ts`
gains a live-query branch behind `NEXT_PUBLIC_SUPABASE_URL` without touching any
component.

## Data-source feasibility (important)

- **Social APIs are restricted.** TikTok has a Research API + Creative Center
  trends; Instagram's Graph API only covers owned accounts; Pinterest has a
  Trends tool. Broad scraping violates ToS. The MVP therefore uses **Google
  Trends + Wikipedia pageviews** as robust, free demand proxies.
- **EU customs data is largely not public** per-shipment (unlike US bills of
  lading). UN Comtrade gives *aggregate* country→country flows by HS code for
  free — enough to rank origin countries and spot emerging ones, but **not**
  per-company. Competitor-level sourcing needs a commercial provider (Panjiva,
  ImportGenius, …) and lands in `competitor_sourcing` in Phase 2.

## Roadmap

- **Phase 1 (this MVP)** — free demand + trade-flow connectors, momentum
  scoring, country-level correlation, dashboard. ✅
- **Phase 2** — embedding-based trend→category classifier (replacing keyword
  matching in `repository.category_for_term`); TikTok/Pinterest connectors;
  commercial bill-of-lading for per-company `competitor_sourcing`; live Supabase
  reads; scheduled ingestion.
- **Phase 3** — supplier entity resolution & graph, competitor assortment
  monitoring, alerting/notifications, multi-tenant.
