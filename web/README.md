# Retail Supply Intel — Web

The buying-team dashboard, in the **NxB Sourcing** design system. One core flow:
**spot a trending product → trace its supply chain → find suppliers → shortlist →
request quotes.**

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build + type-check
npm run typecheck  # tsc --noEmit
npm run lint
```

## How it's built

- **Single client SPA.** `app/page.tsx` (the only server component) imports the
  committed pipeline snapshot, adapts it via `lib/model.ts`, and renders
  `components/Dashboard.tsx`, which owns the view state.
- **Views** (`components/views/`): Overview, Trending (cards/table/compact),
  Deep-dive, Map (animated origin→market flow arcs), Suppliers directory +
  profile drawer, Shortlist + request-quote modal.
- **Styling** is plain CSS — `app/tokens.css` (NxB design tokens, light + `.dark`)
  and `app/app.css` (component styles). Fonts (Suisse Intl, PP Supply Mono) live
  in `public/fonts`. No Tailwind.

## Data

- **Real** (from `lib/snapshot.json`, written by `rsi export`): demand momentum &
  growth, trade-flow origin breakdowns, emerging origins, competitor signals.
- **Illustrative** (`lib/suppliers.ts`): the per-company supplier directory —
  models the Phase-3 "supplier resolution" layer so the trending→suppliers flow
  is demonstrable. Swap in resolved supplier data when available.

To go live against Supabase, replace the snapshot import in `app/page.tsx` with a
query (client factory in `lib/supabase.ts`); the view-model shape stays the same.
