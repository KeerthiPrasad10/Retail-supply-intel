# productScope — Feature List

> **productScope** is the product-scouting platform for Lidl private-label
> sourcing. This feature list is **derived directly from the scouting process**
> (`docs/SCOUTING_PLATFORM_WORKFLOW.md`, assimilated from the two *Scouting
> Process* workflow boards — *Product Proposal by Supplier* and *Product
> Proposal by LKA*).
>
> The goal is **not SupplyScope parity** — it is to cover the capabilities the
> **Lidl scouting process actually needs**, end to end. The SupplyScope
> comparison (`docs/SUPPLYSCOPE_COMPARISON.md`) was input research only; this
> document is the source of truth for what we build.

---

## How to read this

Every feature traces back to a step, role, decision or notification on the
process map. Status reflects the current codebase (June 2026):

| Mark | Meaning |
|:--:|---|
| ✅ | Built and working today |
| 🟡 | Partial / prototype / demo-data |
| ⬜ | Required by the process, **not built yet** |
| 🔵 | Requires CBX (TradeBeyond) or IFS Cloud integration (roadmap) |

**The headline:** productScope has already built the hardest, most
differentiated part — the **AI research & demand×supply intelligence engine**
that turns a raw submission into a decision-ready, ranked product story. What
the process needs next is the **multi-role workflow** around it (C&S → PD →
Buyer), with notifications, sampling, send-out cadence and adoption reporting.

---

## 0. Roles & access (the swim-lanes)

The process runs across seven personas. Each needs a scoped view and actions.

| # | Role | Needs | Status |
|---|------|-------|:--:|
| 0.1 | **Supplier** (external) | Submit proposals, answer questions, send samples, see own submitted/shortlisted/rejected view | 🟡 submission only |
| 0.2 | **LKA Employee** (internal scout) | Submit field finds (store checks, market shopping, trends), QR capture | 🟡 submission only |
| 0.3 | **C&S / Innovations Manager** | First-gate review: quality, categorization, reject-with-reason or forward to PD | ⬜ |
| 0.4 | **PD Manager** | Receive routed proposals, gather all info for buyer send-out | ⬜ |
| 0.5 | **PD Team Member** | Shortlist, request info/samples, build the INT story, bundle into collections | ⬜ |
| 0.6 | **Buyer** | Evaluate shortlisted products — thumbs up / down / question; assign IAN | ⬜ |
| 0.7 | **WoN Heads** | Stay informed via weekly dashboard digest | ⬜ |

> Today productScope has **no role/permission model** — it is a single shared
> board. Role-scoped access is the foundation everything else in the process
> sits on. **Build first.**

---

## 1. Phase 1 — Handing in products (intake)

| # | Feature | Process source | Status |
|---|---------|----------------|:--:|
| 1.1 | **Submission portal** — title + rich product fields | "Upload product proposal onto platform" | ✅ |
| 1.2 | **Multi-image upload** (product + labels/tags/angles) | "Min. quality req.: no. of pictures, picture quality" | ✅ |
| 1.3 | **QR-code public submission** (`/submit`) | "Scanning QR code" (supplier & LKA lanes) | ✅ |
| 1.4 | **Product-link scraping** (paste URL → AI fills the form) | extends "Opening website" intake | ✅ |
| 1.5 | **LKA field-scout capture** — *where the product was seen* (market/shopping), store-check for designs & prints, route trends into design briefings | LKA Employee lane (WF4) | ⬜ |
| 1.6 | **Mandatory-field enforcement** — *what is new* (dropdown), *is it produced for someone else?* | "Mandatory Fields" note | 🟡 free-form, not enforced |
| 1.7 | **Minimum categorization level** on submit (deeper hierarchy optional) | "Minimum categorization level to be filled in" | 🟡 AI suggests, not gated |
| 1.8 | **AI quality filter** — picture quality/size, info completeness gate before posting | "AI Filter for Qualitative Submissions" + "AI Quality Check" | 🟡 AI classifies, no pass/fail gate |
| 1.9 | **Post-to-platform event** + provenance (supplier vs LKA vs scraped) | "Product is posted on Platform" | 🟡 stored, no lifecycle event |

**Built-but-beyond-the-board (productScope's edge at intake):** AI
classification, competitor benchmark, supplier discovery, demand pulse,
strategy analysis and product renderings already run automatically on every
submission — far richer than the board's "AI quality check." ✅

---

## 2. Phase 2 — Managing & curating

### 2A. C&S review (first human gate)

| # | Feature | Process source | Status |
|---|---------|----------------|:--:|
| 2.1 | **C&S review queue** | "C&S Check incl. Rejection Feedback" | ⬜ |
| 2.2 | **Correct categorization** during review | "Correct Categorization if needed" | ⬜ |
| 2.3 | **Reject with reason** (dropdown) → supplier feedback via platform | "Rejection Feedback to Suppliers" | ⬜ |
| 2.4 | **Forward to PD** with auto-routing to the right PD sub-group | "Forward selected Products to PD (should automatically choose right PD)" | ⬜ |
| 2.5 | **Direct-to-PD bypass** (configurable) | open question: "Directly to PD?" | ⬜ |

### 2B. PD intake & enrichment

| # | Feature | Process source | Status |
|---|---------|----------------|:--:|
| 2.6 | **PD intake routing** to the assigned sub-group member | "PD receiving product proposal" | ⬜ |
| 2.7 | **Info loop** — PD asks product questions → supplier answers/adds info | "Answering Product questions", "Adding Additional Information" | 🟡 comments exist; not a structured Q&A loop |
| 2.8 | **Sample loop** — request a physical sample (via HG, up to ~4 weeks) → supplier prepares & sends → PD receives | "Request for physical Sample (HG: up to 4 weeks)" | ⬜ |
| 2.9 | **Tagging & collections** — bundle products into a named collection (e.g. *LadiesSpringSommer*) | "Forwarding Products through tagging", "bundle Products into a collection using Tags" | ⬜ |
| 2.10 | **Pause-until-selection** — hold a product until its collection's selection window; auto send-out on a date or reminder | "Pause until relevant Selection coming up" | ⬜ |

### 2C. Shortlisting & story

| # | Feature | Process source | Status |
|---|---------|----------------|:--:|
| 2.11 | **Shortlist action** (PD Team Member) | "Role: PD Team Member — Task: Shortlist Products" | ⬜ |
| 2.12 | **Build the INT story** — prepare info, must-have vs nice-to-have | "Prepare information around product for INT, build a story" | 🟡 AI strategy analysis is a strong starting point |
| 2.13 | **Ideen-App linkage** — pull idea context into the story | "aus Ideenapp?" | ⬜ |

### 2D. Supplier-offer loop (WF4 — LKA-initiated)

| # | Feature | Process source | Status |
|---|---------|----------------|:--:|
| 2.14 | **Request offers from suppliers** by sub-group | "Requesting Product offers from Suppliers" | ⬜ |
| 2.15 | **Supplier offer submission** in response to a request | "Respective Suppliers receive… request for product offer submission" | 🟡 same form, no request linkage |
| 2.16 | **PD receives supplier submissions** → reject / directly shortlist | "PD receiving product submissions by suppliers" | ⬜ |

---

## 3. Phase 3 — Pushing shortlisted products to the buyer

| # | Feature | Process source | Status |
|---|---------|----------------|:--:|
| 3.1 | **Regular send-out cadence** (next notification cycle, to dashboard) | "Regular Send out with next notification cycle" | ⬜ |
| 3.2 | **Hot-Pocket fast-track** — urgent/trend topics sent to the buyer immediately | "Urgent Trend Topics: Directly sent to Buyer" | ⬜ |
| 3.3 | **Buyer evaluation surface** (weekly digest + immediate hot pockets) | "Role: Buyer — Task: Evaluate Products" | ⬜ |
| 3.4 | **Thumbs up** → takeover into PD process | "Thumbs Up for Product → Takeover into PD Process" | ⬜ |
| 3.5 | **Thumbs down** → end of pilot for that product | "Thumbs Down for Product → END OF PILOT" | ⬜ |
| 3.6 | **Question** → answered & fed back to LKA | "Questions re: Product → Feedback to LKA" | 🟡 comments exist; not a buyer-question loop |
| 3.7 | **Assign IAN** (item number) on takeover | "Adding IAN for Product into Platform?" | 🔵 IFS/CBX |
| 3.8 | **Sample-cycle option** if a sample already exists in SGP/HK | "Add Sample Cycle Option" *(out of scope for pilot)* | ⬜ (deferred) |

---

## 4. Cross-cutting — notifications, reporting, self-service

### 4A. Notification engine

The process is notification-driven across every lane. productScope needs one
engine with per-role, per-event routing across **platform / push / email**.

| # | Event → recipient | Channel (per board) | Status |
|---|-------------------|---------------------|:--:|
| 4.1 | Product posted → Innovations Manager (C&S) | platform + optional push, *no email* | ⬜ |
| 4.2 | Forwarded to PD → assigned PD member | dashboard + email | ⬜ |
| 4.3 | Rejected → supplier | platform mail + dashboard (reason) | ⬜ |
| 4.4 | Info/sample needed → supplier | platform mail + dashboard | ⬜ |
| 4.5 | Offer requested → suppliers (by sub-group) | mail + dashboard | ⬜ |
| 4.6 | Send-out → buyer | weekly digest; hot pockets immediate (email + push) | ⬜ |
| 4.7 | Weekly digest → WoN Heads & LKA | dashboard email (Mondays) | ⬜ |
| 4.8 | **Individualizable frequency** (weekly/monthly/every change) | open question on board | ⬜ |

### 4B. Reporting & analytics (AI / Automations)

| # | Feature | Process source | Status |
|---|---------|----------------|:--:|
| 4.9 | **Weekly funnel report** (Mondays) — submitted · shortlisted vs rejected · approved vs rejected by INT | "Reporting about Submitted Products…" | ⬜ |
| 4.10 | **Adoption-rate metric** (submitted → adopted by INT, overall & per supplier) | "IAN Adoption Rate" | ⬜ |
| 4.11 | **Demand×supply intelligence** — trends, trade-flow origins, emerging sources, procurement triggers | productScope intelligence pipeline (beyond the board) | ✅ |

### 4C. Supplier self-service

| # | Feature | Process source | Status |
|---|---------|----------------|:--:|
| 4.12 | **Supplier portal view** — own submitted / shortlisted / rejected products | "Supplier View: Platform Overview…" | ⬜ |
| 4.13 | **Supplier onboarding** — docs → fields (AI OCR/extract), CBX-aligned schema | onboarding prototype | 🟡 |

---

## 5. Integrations — roadmap (CBX / IFS Cloud)

These light up the right-hand end of the process (takeover, IAN, master data).
Relevant to Lidl because IFS Cloud is the ERP and CBX is the sourcing system of
record — productScope hands off *into* them rather than rebuilding them.

| # | Feature | Why | Status |
|---|---------|-----|:--:|
| 5.1 | **Takeover → CBX PD / critical path** on buyer thumbs-up | "Takeover into PD Process" | 🔵 |
| 5.2 | **IAN/article master** resolution on adoption | "Adding IAN for Product" | 🔵 IFS |
| 5.3 | **Supplier master write-back** from onboarding | onboarding → system of record | 🔵 CBX |
| 5.4 | **Compliance reads** (amfori BSCI / ISO / OEKO-TEX) from CBX | replace mock compliance | 🔵 CBX |
| 5.5 | **Demand-signal feed** into IFS demand planning | intelligence → replenishment | 🔵 IFS |

---

## 6. Build roadmap (priority order, derived from the process)

1. **Role & permission model** (§0) — the foundation; everything downstream is role-scoped.
2. **Lifecycle/workflow state machine** — replace research-only status (`queued→researching→complete`) with the real funnel: `submitted → C&S review → PD intake → shortlisted → sent-out → buyer-decided`, preserving human triage.
3. **C&S review gate** (§2A) — first human checkpoint; reject-with-reason + forward-to-PD routing.
4. **Notification engine** (§4A) — per-role/event/channel; unblocks every lane.
5. **PD curation** (§2B–2C) — info loop, sample loop, tagging/collections, shortlist, story.
6. **Buyer evaluation** (§3) — send-out cadence, Hot Pocket, thumbs up/down/question.
7. **Reporting & adoption rate** (§4B) — the weekly funnel report the boards centre on.
8. **Supplier self-service + offer loop** (§2D, §4C).
9. **CBX/IFS integrations** (§5) — takeover, IAN, supplier master, compliance.

**Already done and ahead of the curve:** the AI research engine, demand×supply
intelligence, submission/QR/URL intake, and the product board — the parts that
make productScope worth building the workflow around.

---

## 7. What we deliberately do *not* build (not relevant to Lidl scouting)

To stay focused on the scouting process — and *not* chase SupplyScope parity —
the following SupplyScope capabilities are explicitly **out of scope** unless
the process later demands them:

- Full **PLM / spec & component library / BOM** — lives in **CBX**; productScope hands off, doesn't replace.
- **Order management / ASN / logistics / financials** — lives in **IFS Cloud**.
- **Digitized QA inspections, test-result management, incident tracking** — CBX/QA systems own this post-adoption.
- **RFP/RFQ & costing engines** — pull from CBX when needed; not rebuilt.
- Generic **Shopify/Xero/Cin7** connectors — irrelevant; Lidl runs IFS + CBX.

> productScope owns **discovery → validation → curation → buyer decision**.
> Everything after *takeover into PD* is a hand-off to CBX/IFS, by design.
