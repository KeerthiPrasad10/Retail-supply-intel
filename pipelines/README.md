# RSI Pipelines

Python ingestion, scoring, and correlation for Retail Supply Intel.

```
demand sources ─┐
                ├─► trend_observations ─► trend_scores ─┐
google_trends   │                                       ├─► correlation ─► triggers
wikipedia       │                                       │
                │                          trade_flows ──┘
comtrade ───────┘ (supply: where it's bought from)
```

## Setup

```bash
uv sync --extra dev        # add --extra postgres to talk to Supabase/Postgres
```

By default everything runs against a local SQLite file at `../data/rsi.db`.
Set `RSI_DATABASE_URL` (e.g. a Supabase Postgres URL) to use a real database.

## Run the pipeline

```bash
uv run rsi db init                 # create schema + seed reference data
uv run rsi ingest                  # all free sources (wikipedia, google_trends, comtrade)
uv run rsi ingest wikipedia        # a single connector
uv run rsi score                   # compute trend momentum
uv run rsi correlate               # generate sourcing triggers
uv run rsi export                  # write web/lib/snapshot.json for the dashboard
uv run rsi run                     # all of the above in order
uv run rsi stats                   # row counts
```

## Tests

```bash
uv run pytest                      # all
uv run pytest tests/test_scoring.py::test_rising_series_has_positive_momentum
```

## Connectors (all free)

| Connector       | Signal  | Key needed | Notes |
|-----------------|---------|------------|-------|
| `wikipedia`     | demand  | no         | Pageviews per category; reliable, global + per-language proxy |
| `google_trends` | demand  | no         | Per-country interest; rate-limited (degrades gracefully) |
| `comtrade`      | supply  | optional   | UN Comtrade import flows by HS code; free preview, or set `RSI_COMTRADE_API_KEY` |

## Schema

`models.py` is the source of truth. Regenerate the Supabase migration with:

```bash
uv run rsi schema --dialect postgres
```
