# Retail Supply Intel — SupplyScope Replacement Roadmap

> **Strategic intent: RSI replaces SupplyScope** for LKA / Nexus Black sourcing.
> This document maps what SupplyScope currently does, where RSI is today, and
> what must be built to close the gap — with CBX (TradeBeyond) and IFS Cloud
> as the system-of-record integrations that replace the capabilities SupplyScope
> outsources to those same platforms via generic APIs.
>
> RSI facts sourced from the codebase (June 2026). SupplyScope, CBX and IFS
> Cloud facts from their public sites and third-party profiles (June 2026) —
> see **Sources** at the end.

---

## 1. Why replace SupplyScope?

SupplyScope is a **mid-funnel PLM/compliance/sampling platform** built for
generic e-commerce brands. It has no demand intelligence, no trade-flow
analysis, and no AI scouting — everything that RSI already does and that
drives sourcing decisions at LKA.

Its integration model is **generic ERP/PLM API connectors** (Shopify, Xero,
Cin7). LKA runs **IFS Cloud** (ERP) and **CBX/TradeBeyond** (sourcing/PLM
system of record) — so SupplyScope would sit *between* those two platforms
as an extra layer rather than replacing them.

RSI's path is simpler: build the PLM/compliance/sampling capabilities
**natively**, wire directly to CBX and IFS Cloud, and own the full funnel
from trend signal to purchase order — cutting SupplyScope out entirely.

| | **Retail Supply Intel (RSI)** | **SupplyScope** |
|---|---|---|
| Front of funnel (demand × supply intelligence) | ✅ **owned** | ⬜ absent |
| AI product scouting & validation | ✅ **owned** | ⬜ absent |
| Mid-funnel (PLM / compliance / sampling / QA) | 🟡 prototype → **roadmap** | ✅ owned |
| System-of-record (supplier master / orders / financials) | 🔵 CBX + IFS via direct API | 🔵 CBX + IFS via generic API |
| LKA-native integrations (CBX field set, IFS OIDC) | 🟡 schema-aligned, not wired | ⬜ not LKA-specific |

---

## 2. RSI feature list — what exists today

Legend: ✅ built & working · 🟡 prototype / demo-data / partial · 🔵 needs CBX or IFS (roadmap) · ⬜ not present

### A. Market intelligence — `pipelines/` (`rsi` CLI) + dashboard
- ✅ **Demand signals** — Google Trends connector (search interest by country/term, ~60-day window). `pipelines/src/rsi/connectors/google_trends.py`
- 🟡 **Extra demand connectors** — TikTok, Instagram, Pinterest, Amazon, AliExpress (opt-in, Apify-backed, spend credits)
- ✅ **Supply signals** — UN Comtrade trade flows (import/export by country-pair, HS code, period). `connectors/comtrade.py`
- ✅ **Momentum scoring** — growth, volume-weighted momentum, **acceleration** (growth-of-growth, leading indicator). `trends/scoring.py`
- ✅ **Correlation engine** — links rising (trend, market) → product category (HS4) → origin countries → **emerging origins** (≥15 % YoY or newly appearing) → competitors sourcing there; emits ranked, explainable **triggers**. `correlation/engine.py`
- ✅ **Procurement insights** — fuses demand + supply into PROCURE / WATCH / HOLD recommendations with confidence + narrative. `insights/engine.py`
- ✅ **Dashboard views** — Market overview, Trending (SURGING/RISING/WATCH tiers), Deep-dive, Insights, **World map**, Suppliers, Shortlist. `web/components/views/`

### B. Product scouting / idea validation — `web/lib/ideas/`
- ✅ **Idea submission** — title + rich fields, **image upload** (multi-image), **QR-code** public `/submit` page, **product-link scraping** (paste a URL → AI fills the form). `app/api/ideas/{analyse-image,scrape-url,upload-image}`
- ✅ **Multi-agent research** (parallel, degrades gracefully):
  - ✅ **Classifier** (Claude vision) → category + product class + keywords
  - ✅ **Competitor benchmark** (Amazon via Apify / web research) → price range, features, ratings
  - ✅ **Supplier discovery** (AliExpress, Alibaba, Made-in-China) → MOQ, store, orders
  - ✅ **Demand pulse** (Reddit + Hacker News, 30 days) with **two-stage LLM relevance judging**
  - ✅ **Product renderings** (fal.ai FLUX Kontext: shelf / lifestyle / hero)
  - ✅ **Strategy analyst** (Claude) → positioning, differentiation, risks, suggested price, next steps
- ✅ **Board UX** — category filter, trending-categories strip, similar-ideas panel, live auto-refresh, status workflow, comments

### C. Supplier onboarding — `web/public/onboard.html` + `web/app/api/extract/`
- 🟡 **Onboarding portal** — record schema **grounded in the full CBX supplier + factory field set**; sections tagged by source (supplier / document / LKA)
- ✅ **Real document extraction** (`/api/extract`) — supplier uploads licence / bank proof / certificate → Claude OCRs, translates, returns per-field values with confidence; prefills blank fields only
- 🟡 **Provenance & confidence** UI — each field shows document / supplier / LKA origin, "reasoned" tags
- 🟡 **Approval workflow** — request → review → pending → active/rejected; GM → COO/HQ gates; explore → onboard → manage lifecycle
- 🟡 **Compliance capture** — amfori BSCI ratings, ISO 14001, fire-safety, OEKO-TEX — **as demo/mock values today**
- 🔵 **Write-back to CBX** is gated and not wired — extract route notes human confirms before write-back

### D. Platform & integrations
- ✅ Supabase (Postgres + Storage), Vercel hosting, snapshot-driven dashboard (live Supabase is a one-line swap, ready)
- ✅ Claude (Anthropic) across classification, analysis, doc extraction, demand judging
- ✅ Apify, fal.ai, Reddit/HN, Firecrawl — all optional, all degrade gracefully
- ⬜ **No live CBX / IFS API connection** — only the CBX-aligned schema in the onboarding prototype

---

## 3. SupplyScope feature list (what we must replace)

- **Product Information Management (PIM)** — central specs, version control, reusable **component library**, audit log, materials / measurements / container planning, external collaboration
- **Workflow & project management** — production lifecycle, **NPD frameworks**, ordering / sampling / QA workflows, **range planning**, customizable processes
- **Compliance management** — automated compliance tracking, supplier compliance, **AI test-report validation** (anti-fraud), automated reminders, inspection checklists, site-audit tracking
- **Quality** — digitized inspections, test-result management, real-time quality metrics, image storage linked to sampling, **incident tracking**
- **Sourcing** — RFP/RFQ creation, supplier comparison, sample management, global vetted supplier network
- **Supplier management** — centralized supplier data, AI-assisted onboarding checks, collaboration
- **Integrations** — flexible APIs to ERP / PLM; named connectors Shopify, Xero, Cin7 (generic — not LKA-specific)
- Target: e-commerce, retail, fashion brands

---

## 4. Capability map — RSI replacement status

✅ already replaces · 🟡 partial → roadmap · 🔵 via CBX/IFS direct integration · ⬜ not started

| Capability | **RSI today** | SupplyScope | **Replacement path** |
|---|:--:|:--:|---|
| Trend / demand intelligence | ✅ | ⬜ | RSI already ahead |
| Trade-flow / origin analysis | ✅ | ⬜ | RSI already ahead |
| AI product scouting & validation | ✅ | ⬜ | RSI already ahead |
| Competitor benchmarking & price discovery | ✅ | ⬜ | RSI already ahead |
| AI product renderings | ✅ | ⬜ | RSI already ahead |
| Procurement recommendations (PROCURE/WATCH/HOLD) | ✅ | ⬜ | RSI already ahead |
| Product idea board / collaboration | ✅ | 🟡 | RSI already ahead |
| Supplier onboarding (AI doc extract) | 🟡 | ✅ | **Phase 2:** wire CBX write-back, harden to production |
| Compliance certs & audits (amfori / ISO / BSCI) | 🟡 (mock) | ✅ | **Phase 2:** replace mocks with CBX reads |
| **PIM / product specs / component library** | ⬜ | ✅ | **Phase 3:** build PIM module, sync to CBX PLM |
| **NPD / critical path management** | ⬜ | ✅ | **Phase 3:** hand-off from scouting board → CBX critical path |
| **Sampling / QA / inspection workflows** | 🟡 (capture only) | ✅ | **Phase 3:** build QA module or deep-link to CBX |
| **RFQ / costing** | ⬜ | 🟡 | **Phase 3:** pull from CBX costing; surface in RSI |
| Test-report validation (AI anti-fraud) | ⬜ | ✅ | **Phase 3:** extend `/api/extract` to test reports |
| Supplier master / record of truth | 🔵 | 🟡 | **Phase 2:** CBX is the master; RSI reads/writes via API |
| Orders / production / ASN / logistics | ⬜ | 🟡 | **Phase 4:** IFS Cloud purchase orders / ASN |
| Article / IAN master, pricing, financials | 🔵 | ⬜ | **Phase 4:** IFS item master resolution on adoption |
| ERP / PLM integration (generic) | 🔵 | ✅ | **Replaced by direct CBX + IFS wiring** — no generic needed |
| Demand forecasting input | ✅ (signals) | ⬜ | Feed RSI momentum into IFS demand planning (Phase 4) |

---

## 5. Replacement roadmap — phased build plan

### Phase 1 — Already done (intelligence + scouting layer)
- ✅ Demand × supply correlation engine
- ✅ AI product scouting, multi-agent research, renderings
- ✅ Supplier onboarding portal (schema), AI doc extraction prototype
- ✅ QR-code idea submission, product-URL scraping

### Phase 2 — Close the supplier/compliance gap (replaces SupplyScope's core differentiator)
1. **CBX supplier/factory write-back** — wire the gated extract output (`/api/extract`) to CBX's REST API; use the existing CBX-aligned field schema (already de-risks the mapping work).
2. **Compliance reads from CBX** — replace mock amfori BSCI / ISO / OEKO-TEX values with live reads from CBX compliance module.
3. **Harden persistence** — replace demo/in-memory fallbacks with hardened Supabase writes before any CBX write path goes live.
4. **Approval workflow** — promote the prototype approval workflow (GM → COO/HQ gates) to production.

### Phase 3 — PLM / QA / sampling (replaces SupplyScope's mid-funnel)
1. **PIM module** — product spec management, component library, version control, audit log; sync spec records to CBX PLM.
2. **NPD / critical-path hand-off** — when a buyer thumbs-up a scouting result, push it into CBX's development / critical-path workflow.
3. **QA / inspection** — digitized inspection checklists, test-result capture, incident tracking; surface in RSI dashboard, persist to CBX.
4. **Test-report validation** — extend `/api/extract` to QA test reports; AI checks for anomalies / anti-fraud signals.
5. **RFQ / costing** — pull supplier offer/costing data from CBX to enrich RSI price benchmarks with actual LKA offers.

### Phase 4 — ERP / financials (replaces SupplyScope ↔ IFS generic connector)
1. **IFS article (IAN) master resolution** — when a buyer adopts a product, resolve/create the article master in IFS via REST API.
2. **Purchase order push/pull** — RSI scouting adoption triggers IFS procurement; RSI surfaces PO / receipt status in the dashboard.
3. **Demand planning feed** — PROCURE/WATCH/HOLD signals and momentum scores feed IFS demand forecasting / replenishment.
4. **SSO / identity** — OIDC integration with IFS Cloud auth so RSI rides the existing identity layer.

---

## 6. CBX / IFS dependency notes

### 6.1 What is blocked today
- `/api/extract` is built and working — capture side is real; **write-back is intentionally gated** (human confirms before any record is touched). No live CBX or IFS API connection in the codebase today.
- Article numbers (IAN), costing/FOB, orders — captured as prototype fields; **not synced**.

### 6.2 CBX (TradeBeyond) — the sourcing/PLM system of record
CBX owns: supplier & factory master, compliance, PLM, costing, orders, inspection, traceability, shipment/ASN, critical path.

To wire Phase 2–3:
- **CBX/TradeBeyond REST API access & licensing** — procurement dependency.
- **Agreed field mapping** — RSI categories/HS4 ↔ CBX merchandise hierarchy & supplier schema (RSI already mirrors the CBX field set — de-risks this significantly).
- **Write-back governance model** — RSI's human-verification gates must satisfy CBX's master-data rules.

### 6.3 IFS Cloud — the ERP/SCM layer
IFS owns: item/article master, costing & pricing, purchase orders, demand/supply planning, financials — all exposed via standard REST APIs + OpenID Connect.

To wire Phase 4:
- **IFS Cloud REST API entitlement + OIDC SSO** — procurement/IT dependency.
- **Canonical product/category mapping** — RSI HS4 ↔ IFS article master & category structure.
- **Master-data ownership decisions** — which system is authoritative for supplier, article, price.

### 6.4 Cross-cutting limitations
- EU customs data is **aggregate** (country-pair / HS level), not per-shipment. "Which competitor sources where" is sparse without a commercial feed (Panjiva / ImportGenius). Affects `competitor_sourcing`.
- **Marketplace/social connectors are Apify-credit-gated** and best-effort; Google Trends rate-limits from datacenter IPs.
- **`NxB_Supplier_Autofill_Wiring_Spec.md`** (referenced by `/api/extract`) is **not in the repo** — the write-back contract is specified by reference only; needs to be formalized before Phase 2.

---

## 7. Net assessment

RSI **already outperforms SupplyScope** on the front of the funnel — demand intelligence, trade-flow analysis, AI scouting — none of which SupplyScope offers. The gap is the PLM/compliance/sampling middle, which SupplyScope currently owns.

The replacement path is:
1. **Phase 2** closes the supplier/compliance gap — the most pressing capability SupplyScope has that RSI lacks — leveraging the CBX-aligned schema already in place.
2. **Phase 3** removes the PLM/QA/sampling dependency — the core of SupplyScope's product.
3. **Phase 4** wires IFS Cloud directly — replacing the only advantage SupplyScope's generic ERP connector gives today.

At Phase 3 completion, RSI covers the full SupplyScope feature set **plus** intelligence and scouting capabilities SupplyScope cannot replicate — with native LKA integrations instead of generic connectors.

---

## Sources

- SupplyScope — [supplyscope.io](https://supplyscope.io/), [Retailers](https://supplyscope.io/retailers/), [feature overview (mirror)](https://supplyscope-hzq899e.gamma.site/), [NavTo.AI profile](https://www.navto.ai/supplyscope), [Allesora review](https://allesora.com/ai-tools/supplyscope-tool/)
- CBX Software / TradeBeyond — [Solutions](https://www.cbxsoftware.com/solutions/), [CBX solutions overview](https://www.tradebeyond.com/blog/the-cbx-solutions)
- IFS Cloud — [IFS Cloud](https://www.ifs.com/en/ifs-cloud), [IFS ERP modules](https://www.astracanyon.com/blog/ifs-erp-modules-list), [IFS supply chain modules](https://www.novacura.com/ifs-modules/ifs-supply-chain/)
- RSI — this repository (`pipelines/`, `web/`, `docs/`) as of June 2026
