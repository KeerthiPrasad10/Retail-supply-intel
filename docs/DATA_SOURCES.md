# Trend & demand data sources

Candidate APIs to expand the **demand** side of the pipeline (today: Wikipedia
pageviews + Google Trends via `pytrends`). Each would become a connector under
`pipelines/src/rsi/connectors/` and must degrade gracefully like the existing
ones. Ordered roughly by fit for a retail private-label sourcing product.

## Recommended next connectors

| Source | Cost | Auth | Signal it adds | Why it fits | Effort |
|---|---|---|---|---|---|
| **DataForSEO — Trends/Keywords** | Paid (pay-as-you-go) | API key | Official Google Trends + search **volume** by keyword/country | Reliable replacement for flaky `pytrends` (no 429s), absolute volumes, per-market | Low |
| **SerpApi — Google Trends** | Paid (free trial) | API key | Google Trends, Autocomplete, Amazon/YouTube SERPs | Same as above; simplest API ergonomics | Low |
| **Keepa** | Paid (subscription) | API key | Amazon **sales-rank / best-seller** history per category & marketplace | Closest thing to real retail demand by product; per-country (DE/FR/UK Amazon) | Medium |
| **Reddit API** | Free tier | OAuth | Community momentum, product mentions/sentiment | Early consumer signal; free; good for "about to trend" | Low–Med |
| **YouTube Data API** | Free quota | API key | Search/video momentum, trending feeds | Free, broad, per-region trending | Low |
| **GDELT 2.0** | Free | none | News/topic volume & tone, multilingual, per-country | Free macro demand & event signal; great country breadth | Medium |
| **Pinterest Trends** | Free (unofficial) / API | Token (official) | Search-intent trends for home/beauty/fashion/food | High intent for private-label categories | Medium (fragile if unofficial) |
| **TikTok Creative Center** | Free (unofficial) | none | Trending hashtags / products / sounds | Strongest youth-consumer trend signal | High (ToS/fragility; prefer Apify) |

## Broader landscape

**Free / freemium**
- **Wikimedia Pageviews** — already integrated; reliable, no key.
- **Google Trends (`pytrends`)** — already integrated; unofficial, rate-limited.
- **Reddit**, **YouTube Data API**, **GDELT**, **Google Books Ngrams** (historical), **Wikidata**.
- **Etsy / eBay APIs** — trending listings (marketplace demand).
- **NewsAPI / Event Registry** — news mentions (freemium).

**Paid — search/keyword volume (drop-in Google Trends upgrades)**
- **DataForSEO**, **SerpApi**, **Keywords Everywhere**, **Semrush / Ahrefs / Moz** APIs.
- **Glimpse** (augments Google Trends with absolute volumes), **Exploding Topics** (curated emerging trends).

**Paid — retail / e-commerce demand (high signal for this product)**
- **Keepa** — Amazon rank/price history.
- **Jungle Scout / Helium 10** — Amazon sales estimates, trending products.
- **Sensor Tower / data.ai** — app-store trends (niche here).

**Paid — social listening**
- **Brandwatch, Talkwalker, Sprinklr, Meltwater, Sprout Social** — enterprise mention/sentiment volume.
- **X/Twitter API** — trends/volume (now costly).
- **Apify** — managed TikTok/Pinterest/Instagram scrapers (usage-based) — the pragmatic way to get social-platform data without official access.

**Paid — retail/fashion trend forecasting (most aligned with a Lidl buying team)**
- **WGSN**, **EDITED**, **Trendalytics**, **Heuritech**, **Stylumia** — assortment & trend forecasting for retail/fashion; enterprise contracts, some with APIs. Directly relevant to private-label category planning.

## Integration notes

- **Mapping to categories**: every demand source emits free-text terms; they map
  onto `product_categories` via `repository.category_for_term` (keyword match
  today → embeddings in Phase 2). New connectors just need to seed terms.
- **Per-country**: prefer sources with a country/market dimension (DataForSEO,
  Keepa marketplaces, GDELT, Google Trends geo) so demand lines up with the
  market dimension already in `trend_observations.country_code`.
- **Keys/secrets**: add as optional `RSI_*` env vars in `config.py`; connectors
  must no-op gracefully when a key is absent (as `comtrade` does).
- **Highest-leverage first pick**: **DataForSEO or SerpApi** (stabilises the
  demand signal we already use) plus **Keepa** (adds real retail demand), then
  **Reddit/GDELT** for free breadth.
