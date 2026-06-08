# Deployment — Supabase + Vercel

This guide provisions the production stores and hosting for Retail Supply Intel:

- **Supabase** — the Postgres store the pipelines write to and (Phase 2) the
  dashboard reads from live.
- **Vercel** — hosts the Next.js dashboard in `web/`.

The app is designed to run with **zero backend**: the dashboard renders the
committed snapshot (`web/lib/snapshot.json`), and the pipelines default to local
SQLite. Everything below is what you wire up to go live.

## Environment variables at a glance

| Variable | Where | Purpose |
|----------|-------|---------|
| `RSI_DATABASE_URL` | `.env` (repo root) / pipeline host | Postgres connection string the pipelines write to. Empty -> SQLite. |
| `RSI_COMTRADE_API_KEY` | `.env` (repo root) / pipeline host | Optional UN Comtrade free-tier key. |
| `NEXT_PUBLIC_SUPABASE_URL` | `web/.env.local` + Vercel | Supabase project URL the dashboard reads. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `web/.env.local` + Vercel | Supabase anon/public key. |

Templates: `.env.example` (root) and `web/.env.example`. The real files
(`.env`, `web/.env.local`) are gitignored.

## 1. Supabase

1. Create a project at <https://supabase.com/dashboard> (note the database
   password you set).
2. Apply the schema. The schema is generated from the SQLAlchemy models in
   `pipelines/src/rsi/models.py`; the committed migration is
   `supabase/migrations/0001_initial_schema.sql`. Pick one:

   - **SQL editor:** paste the contents of `0001_initial_schema.sql` and run it.
   - **Supabase CLI:**

     ```bash
     supabase link --project-ref <PROJECT-REF>
     supabase db push
     ```

   - **Or let the pipeline create it** on first run (`rsi db init`, see below).
3. Collect credentials:
   - **Project Settings -> API:** copy the **Project URL** and the **anon/public**
     key -> these become `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - **Project Settings -> Database -> Connection string -> URI:** copy it and
     prefix the scheme with `+psycopg` for SQLAlchemy ->
     `RSI_DATABASE_URL`.

### Run the pipeline against Supabase

```bash
cd pipelines
uv sync --extra postgres
export RSI_DATABASE_URL='postgresql+psycopg://postgres:[PW]@db.[PROJECT-REF].supabase.co:5432/postgres'
uv run rsi db init     # create schema + seed reference data (idempotent)
uv run rsi run         # ingest -> score -> correlate -> export
```

`rsi export` rewrites `web/lib/snapshot.json`; commit it so the dashboard picks
up fresh data.

## 2. Vercel

The dashboard lives in `web/`, so the Vercel **Root Directory** must be `web`.

### Via the dashboard

1. Import the repo at <https://vercel.com/new>.
2. Set **Root Directory** to `web`. Framework preset auto-detects **Next.js**
   (`web/vercel.json` pins the build/install commands).
3. Add environment variables (Production + Preview):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy. The build prerenders pages from `web/lib/snapshot.json`, so it
   succeeds even before Supabase is wired.

### Via the CLI

```bash
cd web
vercel link            # creates web/.vercel (gitignored)
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel --prod
```

## Running this from a Cursor Cloud Agent

A Cloud Agent cannot authenticate to Supabase or Vercel on its own (the MCP
integrations require interactive auth, and no tokens are present in the VM). To
let an agent provision or deploy on your behalf, add the credentials as **Cloud
Agent secrets** (Cursor Dashboard -> Cloud Agents -> Secrets):

- `RSI_DATABASE_URL`, `RSI_COMTRADE_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_ACCESS_TOKEN` (for the `supabase` CLI), `VERCEL_TOKEN` (for the
  `vercel` CLI)

Secrets persist across runs and are injected as environment variables into new
agent VMs.
