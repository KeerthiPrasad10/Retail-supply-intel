# Retail Supply Intel vs SupplyScope — Feature List, Mapping & Dependencies

> Feature inventory of **Retail Supply Intel (RSI / "NxB Sourcing")** mapped against
> **[SupplyScope](https://supplyscope.io/)**, with explicit callouts for the
> capabilities that depend on **CBX (TradeBeyond)** and **IFS Cloud** — which sit
> further along the roadmap.
>
> RSI facts are sourced from the codebase (June 2026). SupplyScope, CBX/TradeBeyond
> and IFS Cloud facts are from their public sites and third-party profiles (June 2026)
> — see **Sources** at the end.

---

## 1. Positioning — they sit at different points of the same funnel

| | **Retail Supply Intel (RSI)** | **SupplyScope** |
|---|---|---|
| One-liner | Demand×supply **intelligence + AI product scouting** — decides *what to source and from where* | AI **product & compliance platform** — manages *how a product is developed, sampled and kept compliant* |
| Funnel stage | **Upstream** (discovery / validation, front of funnel) | **Midstream** (development → sampling → QA → compliance, PLM-lite) |
| Primary user | Category buyers / sourcing analysts (LKA / private-label) | QA managers, product developers, factory merchandisers |
| Core question answered | "Which trends are rising, who already makes this, and where is it sourced?" | "Is this product spec'd, sampled, tested and compliant before it ships?" |
| Data centre of gravity | External signals (search/social trends, UN trade flows, marketplaces) | Internal product records (specs, components, test reports, supplier docs) |

**Takeaway:** RSI and SupplyScope are **mostly complementary, not head-to-head.**
They overlap on *supplier management* and *product data*, but RSI owns the
*intelligence / scouting* front-end that SupplyScope does not, while SupplyScope
owns the *PLM / compliance / sampling* middle that RSI only prototypes. The heavy
**system-of-record** layer (supplier master, costing, orders, article master)
belongs to **CBX (TradeBeyond)** and **IFS Cloud** downstream.

---

## 2. RSI feature list (what exists today)

Legend: ✅ built & working · 🟡 prototype / demo-data / partial · 🔵 needs CBX or IFS (roadmap) · ⬜ not present

### A. Market intelligence — `pipelines/` (`rsi` CLI) + dashboard
- ✅ **Demand signals** — Google Trends connector (search interest by country/term, ~60-day window). `pipelines/src/rsi/connectors/google_trends.py`
- 🟡 **Extra demand connectors** — TikTok, Instagram, Pinterest, Amazon, AliExpress (opt-in, Apify-backed, spend credits)
- ✅ **Supply signals** — UN Comtrade trade flows (import/export by country-pair, HS code, period). `connectors/comtrade.py`
- ✅ **Momentum scoring** — growth, volume-weighted momentum, **acceleration** (growth-of-growth, leading indicator). `trends/scoring.py`
- ✅ **Correlation engine** — links rising (trend, market) → product category (HS4) → origin countries → **emerging origins** (≥15 % YoY or newly appearing) → competitors sourcing there; emits ranked, explainable **triggers**. `correlation/engine.py`
- ✅ **Procurement insights** — fuses demand+supply into PROCURE / WATCH / HOLD recommendations with confidence + narrative (deterministic, or Claude-written). `insights/engine.py`
- ✅ **Dashboard views** — Market overview, Trending (SURGING/RISING/WATCH tiers), Deep-dive, Insights, **World map**, Suppliers, Shortlist. `web/components/views/`
- ✅ **Single ORM schema** runs identically on SQLite (dev) and Postgres/Supabase (prod). `pipelines/src/rsi/models.py`

### B. Product scouting / idea validation — `web/lib/ideas/`
- ✅ **Idea submission** — title + rich fields, **image upload** (multi-image: product + labels/tags/angles), **QR-code** public `/submit` page, and **product-link scraping** (paste a URL → AI fills the form). `app/api/ideas/{analyse-image,scrape-url,upload-image}`
- ✅ **Multi-agent research** (runs in parallel, degrades gracefully):
  - ✅ **Classifier** (Claude vision) → category + product class + keywords
  - ✅ **Competitor benchmark** (Amazon via Apify / web research) → price range, features, ratings
  - ✅ **Supplier discovery** (AliExpress, Alibaba, Made-in-China via Apify; web sourcing) → MOQ, store, orders
  - ✅ **Demand pulse** (Reddit + Hacker News, last 30 days) with **two-stage relevance** (keyword pre-filter → LLM judge)
  - ✅ **Product renderings** (fal.ai FLUX Kontext: shelf / lifestyle / hero scenes)
  - ✅ **Strategy analyst** (Claude) → positioning, differentiation, risks, suggested price, next steps
- ✅ **Board UX** — category filter, **trending-categories strip**, **similar-ideas** panel, **live auto-refresh**, status workflow (queued → researching → complete), comments thread
- 🟡 **Demo fallback** — with no API keys the whole flow returns synthetic data so it always renders
- 🟡 **Similar-ideas** matching is word-overlap, not embeddings (Phase-2 swaps in embeddings)

### C. Supplier onboarding — `web/public/onboard.html` + `web/app/api/extract/`
- 🟡 **Supplier onboarding portal** ("IFS Nexus Black Supply · LKA") — **record schema grounded in the full CBX supplier + factory field set, tagged by source** (supplier / document / LKA)
- ✅ **Real document extraction** (`/api/extract`) — supplier uploads licence / bank proof / certificate → Claude **OCRs, translates to English, and returns per-field values with confidence**; prefills blank fields only
- 🟡 **Provenance & confidence** UI — each field shows whether it came from a document (with confidence), the supplier, or LKA; "reasoned" tags
- 🟡 **Approval workflow** — request → review → pending → active/rejected, with gates **GM → COO/HQ**; lifecycle explore → onboard → manage
- 🟡 **Compliance capture** — amfori BSCI section ratings, ISO 14001, fire-safety, OEKO-TEX (conditional on product type) — **as demo/mock values**
- 🔵 **Write-back to the system of record is explicitly gated and NOT wired** — the extract route notes a human confirms and "LKA independently verifies before anything is treated as written-back." No live CBX/IFS connection exists.

### D. Platform & integrations
- ✅ Supabase (Postgres + Storage), Vercel hosting, snapshot-driven dashboard (swap-in to live Supabase is a one-line change, ready but not wired)
- ✅ Claude (Anthropic) across classification, analysis, doc extraction, demand judging
- ✅ Apify, Firecrawl, fal.ai, Algolia/HN, Reddit — all optional, all degrade gracefully
- ⬜ **No ERP / PLM / CBX / IFS integration code** — only the CBX-aligned schema in the onboarding prototype

---

## 3. SupplyScope feature list (public)

- **Product Information Management (PIM)** — central specs, version control, reusable **component library**, change history / **audit log**, materials/measurements/container planning, external collaboration
- **Workflow & project management** — production lifecycle, **NPD frameworks**, ordering / sampling / QA workflows, **range planning**, sourcing workflows, customizable processes
- **Compliance management** — automated compliance processes, supplier compliance tracking, **AI test-report validation** (anti-fraud), automated reminders/tasks, inspection checklists, site-audit tracking
- **Quality** — digitized inspections, test-result management, real-time quality metrics, image storage linked to sampling, **incident tracking**
- **Sourcing** — RFP/RFQ creation, supplier comparison, sample management, **global vetted supplier network**
- **Supplier management** — centralized supplier data, AI-assisted onboarding checks, collaboration
- **Integrations** — **flexible APIs to existing ERP / PLM** systems; named connectors **Shopify, Xero, Cin7**
- **Security** — data-protection controls, global-regulation support
- Target: e-commerce, retail, **fashion brands**; roles QA / product dev / factory merchandiser

---

## 4. Capability mapping (RSI ↔ SupplyScope ↔ CBX ↔ IFS Cloud)

✅ strong · 🟡 partial/prototype · 🔵 roadmap (needs CBX/IFS) · ⬜ none

| Capability | RSI | SupplyScope | CBX / TradeBeyond | IFS Cloud |
|---|:--:|:--:|:--:|:--:|
| Trend / demand intelligence (search, social, marketplace) | ✅ | ⬜ | ⬜ | ⬜ |
| Trade-flow / origin & emerging-source analysis | ✅ | ⬜ | 🟡 (traceability) | ⬜ |
| AI product **scouting & validation** (idea → market research) | ✅ | ⬜ | ⬜ | ⬜ |
| Competitor benchmarking & price-range discovery | ✅ | ⬜ | ⬜ | ⬜ |
| AI product **renderings** | ✅ | ⬜ | 🟡 (3D design) | ⬜ |
| Procurement recommendations (PROCURE/WATCH/HOLD) | ✅ | ⬜ | ⬜ | 🟡 (planning) |
| Product idea board / collaboration | ✅ | 🟡 | ✅ | ⬜ |
| **PIM / product specs / component library** | ⬜ | ✅ | ✅ (PLM) | 🟡 (item master) |
| **NPD frameworks / critical path** | ⬜ | ✅ | ✅ | 🟡 |
| **Sampling / QA / inspection** workflows | 🟡 (capture only) | ✅ | ✅ | 🟡 |
| **Supplier onboarding** (docs → fields) | 🟡 (AI extract, prototype) | ✅ | ✅ | 🟡 |
| **Supplier master / record of truth** | 🔵 | 🟡 | ✅ | ✅ |
| **Compliance certs & audits** (amfori/ISO/BSCI) | 🟡 (capture, mock) | ✅ | ✅ | 🟡 |
| **Costing / RFQ / offers** | ⬜ | 🟡 | ✅ | ✅ |
| **Orders / production / ASN / logistics** | ⬜ | 🟡 | ✅ | ✅ |
| **Article / IAN master, pricing, financials** | 🔵 | ⬜ | 🟡 | ✅ |
| Generic **ERP/PLM API** connectors | 🔵 | ✅ (Shopify/Xero/Cin7 + ERP/PLM) | ✅ | ✅ (REST + OIDC) |

**Reading the table**
- RSI is **uniquely strong** on the left block (intelligence + scouting) — neither SupplyScope, CBX nor IFS does this.
- SupplyScope and CBX **own the middle** (PLM, sampling, compliance, costing). RSI only **prototypes** supplier onboarding/compliance.
- CBX and IFS **own the system-of-record bottom** (supplier master, orders, article/financials) — that's where RSI's 🔵 items must integrate, not rebuild.

---

## 5. Dependencies & limitations — especially CBX / IFS Cloud (roadmap)

### 5.1 Where RSI stands **today**
- The supplier onboarding record is **schema-aligned to CBX** (the field set, sections, factory records) but holds **demo data**; there is **no live CBX or IFS API connection** in the codebase.
- `/api/extract` is a **real** Claude-powered document → field extractor with confidence — i.e. the *capture* side is built; the *write-back* side is intentionally **stubbed and human-gated**.
- Article numbers (**IAN**), costing/FOB, target prices, orders are **captured as fields** in the prototype but **not synced** to any ERP.

### 5.2 Capabilities that **depend on CBX (TradeBeyond)**
CBX is the retail **sourcing/PLM system of record**: Supplier & factory master, Supplier Compliance, PLM, Costing, Order Management, Inspection, Traceability, Shipment/ASN, **critical-path management**.

To light these up, RSI must:
1. **Write back the onboarded supplier/factory record** (today's gated extract output) into CBX's supplier+factory master — RSI already mirrors the CBX field set, which de-risks the mapping.
2. **Read compliance & audit state** (amfori BSCI, ISO, fire, OEKO-TEX) from CBX rather than mock values.
3. **Hand off shortlisted ideas** into CBX product development / critical path once a buyer thumbs-up (the scouting workflow's "Takeover into PD process").
4. **Pull costing / RFQ / offer** data back to enrich RSI's price benchmarks with *actual* supplier offers.

> **Dependency / limitation:** requires **CBX/TradeBeyond API access & licensing**, an agreed **field-mapping** (RSI categories/HS4 ↔ CBX merchandise hierarchy & supplier schema), and a **write-back governance model** (RSI's human-verification gates must satisfy CBX's master-data rules).

### 5.3 Capabilities that **depend on IFS Cloud**
IFS Cloud is the **ERP/EAM/SCM** layer (the user's own platform): item/article master, costing & pricing, purchase orders, demand/supply planning, financials — **everything exposed via standard REST APIs + OpenID Connect**.

To light these up, RSI must:
1. **Resolve/create the article (IAN) master** in IFS when a buyer adopts a product (replacing the prototype's manual IAN field).
2. **Push approved suppliers & terms** into IFS procurement; **pull PO / order / receipt** status back.
3. **Feed planning** — RSI's PROCURE/WATCH/HOLD insights and demand momentum become inputs to IFS demand forecasting / replenishment.
4. **Single sign-on / identity** via OIDC so RSI rides IFS Cloud auth.

> **Dependency / limitation:** requires **IFS Cloud REST API entitlement + OIDC SSO**, a **canonical product/category mapping** (RSI HS4 ↔ IFS article master & category structure), and decisions on **master-data ownership** (which system is authoritative for supplier, article, price).

### 5.4 Cross-cutting limitations to flag
- **EU customs data is aggregate** (country-pair/HS level), not per-shipment bills of lading — so "which *competitor* sources where" is sparse without a commercial feed (Panjiva/ImportGenius). Affects `competitor_sourcing`.
- **Marketplace/social connectors are Apify-credit-gated** and best-effort; Google Trends rate-limits from datacenter IPs.
- **Demo/in-memory fallbacks** mean a non-configured environment looks complete but isn't persisting — must be hardened before any CBX/IFS write path.
- **SupplyScope already ships generic ERP/PLM API integration** (and Shopify/Xero/Cin7); RSI's equivalent is **roadmap**, so for a buyer comparing today, integration breadth is a SupplyScope advantage while *intelligence/scouting* is RSI's.
- The **`NxB_Supplier_Autofill_Wiring_Spec.md`** referenced by `/api/extract` is **not in the repo** — the write-back contract is specified by reference only.

---

## 6. Net assessment

- **Don't position RSI as a SupplyScope replacement.** RSI wins the **front of the funnel** (trend intelligence + AI scouting/validation) that SupplyScope lacks; SupplyScope/CBX win the **PLM/compliance/costing middle**.
- **The integration story is the moat.** RSI's value compounds when its scouting/onboarding output **flows into CBX (sourcing/PLM) and IFS Cloud (ERP)** — schema alignment with CBX is already in place, so the gap is **API wiring + governance, not data modelling**.
- **Near-term priorities** to make the roadmap real: (1) CBX supplier/factory write-back from the gated extract output, (2) IFS article-master + procurement push/pull on buyer adoption, (3) replace mock compliance with CBX reads, (4) harden persistence away from demo/in-memory before any write path.

---

## Sources

- SupplyScope — [supplyscope.io](https://supplyscope.io/), [Retailers](https://supplyscope.io/retailers/), [feature overview (mirror)](https://supplyscope-hzq899e.gamma.site/), [NavTo.AI profile](https://www.navto.ai/supplyscope), [Allesora review](https://allesora.com/ai-tools/supplyscope-tool/)
- CBX Software / TradeBeyond — [Solutions](https://www.cbxsoftware.com/solutions/), [CBX solutions overview](https://www.tradebeyond.com/blog/the-cbx-solutions)
- IFS Cloud — [IFS Cloud](https://www.ifs.com/en/ifs-cloud), [IFS ERP modules](https://www.astracanyon.com/blog/ifs-erp-modules-list), [IFS supply chain modules](https://www.novacura.com/ifs-modules/ifs-supply-chain/)
- RSI — this repository (`pipelines/`, `web/`, `docs/`) as of June 2026
