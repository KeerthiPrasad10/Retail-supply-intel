# Retail Supply Intel

A retail intelligence platform that connects **consumer demand signals** (social
& search momentum) to **international supply chains** (trade flows), and surfaces
ranked, explainable **sourcing triggers**:

> *"Demand for Coffee is rising in France (+508%). Top origins: Germany, Belgium,
> Brazil, **Vietnam (+32%, emerging)**. → Investigate Vietnamese suppliers before
> competitors lock them in."*

Each trigger answers: what's trending, where it's bought from, which origins are
**emerging**, and — where data allows — which competitors already source there.

## Stack

- **`pipelines/`** — Python (uv): ingestion connectors, momentum scoring, the
  demand×supply correlation engine, and a `rsi` CLI.
- **`web/`** — Next.js + Tailwind dashboard (Overview / Triggers / Trends / Suppliers).
- **`supabase/`** — Postgres schema (the production store). SQLite is used for
  zero-config local dev.

Data sources are all **free**: Google Trends + Wikipedia pageviews (demand) and
UN Comtrade (supply). See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the
full design, data model, and roadmap.

## Quickstart

### 1. Pipelines — produce intelligence

```bash
cd pipelines
uv sync --extra dev
uv run rsi run          # db init → ingest (live) → score → correlate → export
uv run rsi stats        # row counts
```

This populates `data/rsi.db` (SQLite) and writes `web/lib/snapshot.json`.

### 2. Web — explore it

```bash
cd web
npm install
npm run dev             # http://localhost:3000
```

The dashboard renders the committed snapshot, so it works with zero backend
setup. Point it at Supabase later via `web/.env.example`.

## Deploy — Supabase + Vercel

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full walkthrough. In short:

**Supabase (Postgres store):**

```bash
cd pipelines
uv sync --extra postgres
export RSI_DATABASE_URL='postgresql+psycopg://postgres:[PW]@db.[PROJECT-REF].supabase.co:5432/postgres'
uv run rsi run
```

Apply `supabase/migrations/0001_initial_schema.sql` to provision the schema (or
let `rsi db init` create it).

**Vercel (dashboard hosting):** import the repo, set the **Root Directory** to
`web`, and add the `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
environment variables. The build prerenders from the committed snapshot, so it
works even before Supabase is connected.

Environment templates live in `.env.example` (pipelines, `RSI_*`) and
`web/.env.example` (dashboard, `NEXT_PUBLIC_SUPABASE_*`). Copy them to `.env`
and `web/.env.local` respectively and fill in your credentials.

## Layout

```
pipelines/   Python ingestion + ML + correlation (uv, SQLAlchemy, Typer)
web/         Next.js dashboard
supabase/    Postgres migrations (generated from the ORM models)
docs/        Architecture & design
data/        Local SQLite store (gitignored)
```
