# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Retail Supply Intel connects **demand signals** (social/search momentum) to
**supply signals** (international trade flows) and emits ranked, explainable
**sourcing triggers**: *trend rising in market → product category → origin
countries → emerging ones → competitors sourcing there.* Read
`docs/ARCHITECTURE.md` for the full picture before making structural changes.

Two deployables:
- `pipelines/` — Python (uv): connectors → scoring → correlation → snapshot, via the `rsi` CLI.
- `web/` — Next.js + Tailwind dashboard.

## Commands

Pipelines (run from `pipelines/`):

```bash
uv sync --extra dev                 # install (add --extra postgres for Supabase/Postgres)
uv run rsi run                      # full pipeline: db init → ingest → score → correlate → export
uv run rsi ingest [connector...]    # connectors: wikipedia | google_trends | comtrade (default: all)
uv run rsi score / correlate / export / stats
uv run pytest                       # tests
uv run pytest tests/test_scoring.py::test_flat_series_has_near_zero_growth   # single test
uv run ruff check src tests         # lint (ruff is the linter/formatter)
uv run rsi schema --dialect postgres  # regenerate Supabase DDL from the ORM models
```

Web (run from `web/`):

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # also type-checks; pages prerender from web/lib/snapshot.json
npm run typecheck  # tsc --noEmit
npm run lint
```

## Architecture notes that aren't obvious from one file

- **`pipelines/src/rsi/models.py` is the single source of truth for the schema.**
  SQLite (local dev, `data/rsi.db`) and Postgres/Supabase run the *same* models.
  After changing models, regenerate `supabase/migrations/0001_initial_schema.sql`
  with `rsi schema --dialect postgres` — do not hand-edit the migration.

- **Store selection is by env**: unset `RSI_DATABASE_URL` → SQLite; set it →
  Postgres (needs `uv sync --extra postgres`). Config lives in `config.py`.

- **The HS4 `hs_code` on `product_categories` is the join key** between social
  trends and customs data; `keywords` map free-text trends onto a category
  (`repository.category_for_term`, currently substring matching — Phase 2 swaps
  in embeddings).

- **Connectors must degrade gracefully.** Every connector (`connectors/`)
  swallows network/rate-limit errors and returns a partial row count so a flaky
  source never aborts a pipeline run. Google Trends in particular rate-limits
  (429) and often returns little; Wikipedia and Comtrade are reliable.

- **Correlation re-runs preserve human triage**: `run_correlation` deletes only
  `status='new'` triggers, leaving `actioned`/`dismissed` ones intact.

- **The dashboard's data path is `web/lib/snapshot.json`** (written by
  `rsi export`, committed to the repo) read via `web/lib/data.ts`. The data-layer
  functions are async so a live Supabase branch (behind `NEXT_PUBLIC_SUPABASE_URL`)
  can be added without changing components. Regenerate the snapshot after
  pipeline changes that affect output.

## Conventions

- Python: ruff (`select = E,F,I,UP,B`, line length 100; `B008` ignored for
  Typer). Typed SQLAlchemy 2.0 ORM. Pure, testable logic (e.g.
  `series_momentum`) kept separate from DB-driven functions.
- Web: server components by default; `"use client"` only where needed (e.g.
  `Nav`). `@/*` path alias maps to `web/`.
