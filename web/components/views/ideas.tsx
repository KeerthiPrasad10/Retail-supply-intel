"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductIdea, ResearchResult } from "@/lib/ideas/types";
import { cc } from "@/lib/util";
import { Icons } from "../icons";
import { StatTile } from "./shared";

const CATEGORIES = [
  "Apparel & Fashion",
  "Drinkware & Kitchen",
  "Home & Living",
  "Baby & Kids",
  "Beauty & Personal Care",
  "Sports & Outdoors",
  "Electronics & Accessories",
  "Pet Products",
];

const MAX_IMAGE_BYTES = 1_500_000;

const PIPELINE = [
  { id: "classify", name: "Classifier", desc: "Classifying the product & deriving search terms…", icon: "spark" as const },
  { id: "stores", name: "Online Stores", desc: "Scanning Amazon for live listings & prices…", icon: "box" as const },
  { id: "web", name: "Web Research", desc: "Searching the web for similar products…", icon: "search" as const },
  { id: "suppliers", name: "China Suppliers", desc: "Finding AliExpress & web suppliers…", icon: "factory" as const },
  { id: "analyst", name: "Strategy Analyst", desc: "Synthesising positioning, pricing & next steps…", icon: "pulse" as const },
];

type Stage = "form" | "running" | "results" | "error";

export function Ideas() {
  const [stage, setStage] = useState<Stage>("form");
  const [idea, setIdea] = useState<ProductIdea | null>(null);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const stepTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const imageUrlRef = useRef<string>("");

  const [recent, setRecent] = useState<ProductIdea[]>([]);
  const loadRecent = useCallback(() => {
    fetch("/api/ideas")
      .then((r) => r.json())
      .then((d) => setRecent(Array.isArray(d?.ideas) ? d.ideas : []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  function startStepAnimation() {
    setActiveStep(0);
    clearInterval(stepTimer.current);
    stepTimer.current = setInterval(() => {
      setActiveStep((s) => Math.min(s + 1, PIPELINE.length - 1));
    }, 3000);
  }

  async function submit(payload: Record<string, string>) {
    setError(null);
    setStage("running");
    startStepAnimation();
    try {
      const createRes = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const created = await createRes.json();
      if (!createRes.ok) throw new Error(created?.error || "Could not submit the idea.");
      const newIdea: ProductIdea = created.idea;
      setIdea(newIdea);

      const res = await fetch(`/api/ideas/${newIdea.id}/research`, { method: "POST" });
      const data = await res.json();
      if (!res.ok && !data?.idea) throw new Error(data?.error || "Research failed.");
      const research: ResearchResult | undefined = data?.idea?.research;
      clearInterval(stepTimer.current);
      if (!research || research.error) {
        setError(research?.error || "Research did not complete.");
        setStage("error");
        return;
      }
      setResult(research);
      setStage("results");
      loadRecent();
    } catch (err) {
      clearInterval(stepTimer.current);
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStage("error");
    }
  }

  function reset() {
    setStage("form");
    setIdea(null);
    setResult(null);
    setError(null);
    imageUrlRef.current = "";
  }

  function viewIdea(i: ProductIdea) {
    if (!i.research) return;
    setIdea(i);
    setResult(i.research);
    setStage("results");
  }

  return (
    <div className="content">
      <header className="page-head">
        <div>
          <h1 className="page-title">Add a product idea</h1>
          <p className="page-sub">
            Drop a photo and AI fills in the details. Agents then research the live market —{" "}
            <b>pricing, China &amp; web suppliers, competitor benchmarks, and a sourcing strategy</b>.
            Ideas are saved and classified so you can track them over time.
          </p>
        </div>
        {stage !== "form" && (
          <button className="btn secondary sm" onClick={reset}>
            <Icons.plus size={14} />
            New idea
          </button>
        )}
      </header>

      {stage === "form" && (
        <div className="ideas-layout">
          <SubmitForm imageUrlRef={imageUrlRef} onSubmit={submit} />
          <RecentIdeas ideas={recent} onView={viewIdea} />
        </div>
      )}

      {stage === "running" && idea && <RunningView idea={idea} activeStep={activeStep} />}

      {stage === "error" && (
        <div className="callout warn">
          <Icons.alert size={15} />
          <p>{error || "Research failed to complete. Please try again."}</p>
        </div>
      )}

      {(stage === "results" || (stage === "error" && result)) && result && idea && (
        <Results idea={idea} result={result} />
      )}
    </div>
  );
}

/* ------------------------------ Recently validated ------------------------------ */

const STATUS_BADGE: Record<ProductIdea["status"], { cls: string; label: string }> = {
  queued: { cls: "", label: "queued" },
  researching: { cls: "med", label: "researching" },
  complete: { cls: "low", label: "complete" },
  error: { cls: "high", label: "error" },
};

function RecentIdeas({ ideas, onView }: { ideas: ProductIdea[]; onView: (i: ProductIdea) => void }) {
  if (!ideas.length) return null;
  return (
    <section className="panel idea-recent">
      <p className="panel-h">
        <Icons.grid size={13} /> Recently validated
        <span className="panel-meta">{ideas.length}</span>
      </p>
      <ul className="idea-recent-list">
        {ideas.map((i) => {
          const s = STATUS_BADGE[i.status] ?? STATUS_BADGE.queued;
          return (
            <li key={i.id} className="idea-recent-row">
              <div className="idea-recent-main">
                <span className="idea-recent-title">{i.title}</span>
                {i.category ? <span className="cat-chip">{i.category}</span> : null}
              </div>
              <div className="idea-recent-meta">
                <span className={cc("badge", s.cls)}>
                  {(i.status === "complete" || i.status === "researching") && <span className="dot" />}
                  {s.label}
                </span>
                {i.research ? (
                  <button className="link-btn" onClick={() => onView(i)}>
                    View <Icons.arrowRight size={12} />
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------ Submit form ------------------------------ */

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {required && <span className="field-req"> *</span>}
      </span>
      {hint && <span className="field-hint">{hint}</span>}
      <div className="field-control">{children}</div>
    </label>
  );
}

type AutofillState = "idle" | "loading" | "done" | "error";

type IdeaFields = {
  title: string;
  description: string;
  category: string;
  features: string;
  priceTarget: string;
  targetMarket: string;
  audience: string;
  submittedBy: string;
};

const EMPTY_FIELDS: IdeaFields = {
  title: "",
  description: "",
  category: "",
  features: "",
  priceTarget: "",
  targetMarket: "",
  audience: "",
  submittedBy: "",
};

function SubmitForm({
  imageUrlRef,
  onSubmit,
}: {
  imageUrlRef: React.MutableRefObject<string>;
  onSubmit: (payload: Record<string, string>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [autofill, setAutofill] = useState<AutofillState>("idle");
  const [fields, setFields] = useState<IdeaFields>(EMPTY_FIELDS);
  const [formError, setFormError] = useState<string | null>(null);

  function setField(key: keyof IdeaFields, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function analyseImage(dataUrl: string) {
    setAutofill("loading");
    setFormError(null);
    try {
      const res = await fetch("/api/ideas/analyse-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        // silently fall through to manual entry — not a hard error
        setAutofill("error");
        return;
      }
      const f = data.fields as Partial<IdeaFields>;
      setFields((prev) => ({
        title: f.title || prev.title,
        description: f.description || prev.description,
        category: f.category || prev.category,
        features: f.features || prev.features,
        priceTarget: f.priceTarget || prev.priceTarget,
        targetMarket: f.targetMarket || prev.targetMarket,
        audience: f.audience || prev.audience,
        submittedBy: prev.submittedBy,
      }));
      setAutofill("done");
    } catch {
      setAutofill("error");
    }
  }

  function handleFile(file?: File) {
    setFormError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFormError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setFormError("Image is too large (max 1.5 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setImagePreview(dataUrl);
      imageUrlRef.current = dataUrl;
      analyseImage(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function removeImage() {
    setImagePreview("");
    imageUrlRef.current = "";
    setAutofill("idle");
    setFields(EMPTY_FIELDS);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!fields.title.trim()) {
      setFormError("Please give your product idea a title.");
      return;
    }
    onSubmit({ ...fields, imageUrl: imageUrlRef.current });
  }

  const isAnalysing = autofill === "loading";

  return (
    <form className="panel idea-form" onSubmit={handleSubmit}>
      {/* ── Image drop zone — primary input ── */}
      <div
        className={cc("idea-image-zone", imagePreview && "has-image")}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFile(e.dataTransfer.files?.[0]);
        }}
      >
        {imagePreview ? (
          <div className="idea-image-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="Product" className="idea-image-thumb" />
            <div className="idea-image-overlay">
              {isAnalysing && (
                <span className="idea-analyse-badge">
                  <span className="spinner" aria-hidden /> Analysing image…
                </span>
              )}
              {autofill === "done" && (
                <span className="idea-analyse-badge done">
                  <Icons.check size={12} /> Fields filled by AI — review below
                </span>
              )}
              {autofill === "error" && (
                <span className="idea-analyse-badge warn">
                  <Icons.alert size={12} /> Could not auto-fill &mdash; fill manually
                </span>
              )}
              <button type="button" className="idea-image-remove" onClick={removeImage}>
                <Icons.x size={14} /> Change image
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="idea-image-drop"
            onClick={() => fileRef.current?.click()}
          >
            <span className="idea-image-drop-icon">
              <Icons.box size={32} />
            </span>
            <span className="idea-image-drop-main">Drop a product photo to get started</span>
            <span className="idea-image-drop-sub">AI fills the form for you · PNG/JPG up to 1.5 MB · or fill in manually below</span>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden-input"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {/* ── Fields — shown always, disabled while analysing ── */}
      <fieldset className="idea-fields" disabled={isAnalysing}>
        <Field label="Product title" required>
          <input
            value={fields.title}
            onChange={(e) => setField("title", e.target.value)}
            required
            placeholder="e.g. Insulated stainless steel kids' water bottle"
            className={cc("nxb-input", autofill === "done" && fields.title && "autofilled")}
          />
        </Field>

        <Field label="Description" hint="What it is, who it's for, what makes it different.">
          <textarea
            value={fields.description}
            onChange={(e) => setField("description", e.target.value)}
            rows={3}
            placeholder="Describe the product…"
            className={cc("nxb-input", autofill === "done" && fields.description && "autofilled")}
          />
        </Field>

        <div className="field-row">
          <Field label="Category">
            <input
              value={fields.category}
              onChange={(e) => setField("category", e.target.value)}
              list="ideas-category-options"
              placeholder="Choose or type…"
              className={cc("nxb-input", autofill === "done" && fields.category && "autofilled")}
            />
            <datalist id="ideas-category-options">
              {CATEGORIES.map((c) => <option key={c} value={c} />)}
            </datalist>
          </Field>
          <Field label="Target price">
            <input
              value={fields.priceTarget}
              onChange={(e) => setField("priceTarget", e.target.value)}
              placeholder="e.g. $30–45"
              className={cc("nxb-input", autofill === "done" && fields.priceTarget && "autofilled")}
            />
          </Field>
        </div>

        <div className="field-row">
          <Field label="Target market">
            <input
              value={fields.targetMarket}
              onChange={(e) => setField("targetMarket", e.target.value)}
              placeholder="e.g. Australia, UK"
              className={cc("nxb-input", autofill === "done" && fields.targetMarket && "autofilled")}
            />
          </Field>
          <Field label="Target audience">
            <input
              value={fields.audience}
              onChange={(e) => setField("audience", e.target.value)}
              placeholder="e.g. Parents of toddlers"
              className={cc("nxb-input", autofill === "done" && fields.audience && "autofilled")}
            />
          </Field>
        </div>

        <Field label="Key features" hint="One per line — helps agents benchmark.">
          <textarea
            value={fields.features}
            onChange={(e) => setField("features", e.target.value)}
            rows={3}
            placeholder={"Leak-proof lid\nBPA-free\nHolds 500ml"}
            className={cc("nxb-input", autofill === "done" && fields.features && "autofilled")}
          />
        </Field>

        <Field label="Your name / team" hint="Optional.">
          <input
            value={fields.submittedBy}
            onChange={(e) => setField("submittedBy", e.target.value)}
            placeholder="e.g. Priya, Product team"
            className="nxb-input"
          />
        </Field>
      </fieldset>

      {formError && (
        <div className="callout warn">
          <Icons.alert size={15} />
          <p>{formError}</p>
        </div>
      )}

      <div className="idea-form-foot">
        <button type="submit" className="btn primary" disabled={isAnalysing}>
          {isAnalysing ? (
            <><span className="spinner sm" aria-hidden /> Analysing image…</>
          ) : (
            <><Icons.spark size={15} /> Add idea &amp; research</>
          )}
        </button>
        <span className="idea-form-note">Agents benchmark market prices, suppliers and competitors.</span>
      </div>
    </form>
  );
}

/* ------------------------------ Running view ------------------------------ */

function RunningView({ idea, activeStep }: { idea: ProductIdea; activeStep: number }) {
  return (
    <>
      <div className="panel idea-banner">
        <span className="idea-banner-icon">
          <Icons.spark size={18} />
        </span>
        <div>
          <p className="idea-banner-title">Researching “{idea.title}”</p>
          <p className="idea-banner-sub">AI agents are seeking market info and benchmarking similar products…</p>
        </div>
      </div>
      <div className="pipeline-grid">
        {PIPELINE.map((step, i) => {
          const state = i < activeStep ? "done" : i === activeStep ? "active" : "pending";
          const Icon = Icons[step.icon];
          return (
            <div key={step.id} className={cc("pipeline-card", state)}>
              <div className="pipeline-card-top">
                <span className="pipeline-card-icon">
                  <Icon size={15} />
                </span>
                {state === "done" ? (
                  <Icons.check size={16} />
                ) : state === "active" ? (
                  <span className="spinner" aria-hidden />
                ) : (
                  <span className="pipeline-dot" aria-hidden />
                )}
              </div>
              <p className="pipeline-card-name">{step.name}</p>
              <p className="pipeline-card-desc">{step.desc}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ------------------------------ Results ------------------------------ */

function Results({ idea, result }: { idea: ProductIdea; result: ResearchResult }) {
  const pr = result.benchmark.priceRange;
  const fmt = (n: number) => `${pr?.currency === "USD" ? "$" : (pr?.currency || "$") + " "}${Math.round(n)}`;
  const a = result.analysis;

  return (
    <div className="ideas-results">
      <div className="stat-row">
        <StatTile value={result.benchmark.competitors.length} label="Products benchmarked" sub="across stores & web" />
        <StatTile value={result.suppliers?.length ?? 0} label="Suppliers found" sub="China + web sourcing" />
        <StatTile
          value={pr ? fmt(pr.avg) : "—"}
          label="Avg market price"
          sub={pr ? `${fmt(pr.min)} – ${fmt(pr.max)}` : "no pricing extracted"}
          accent
        />
        <StatTile
          value={result.mode === "live" ? "Live" : "Demo"}
          label="Research mode"
          sub={result.mode === "live" ? `${(result.durationMs / 1000).toFixed(1)}s` : "set API keys for live data"}
        />
      </div>

      {result.mode === "demo" && (
        <div className="callout warn">
          <Icons.alert size={15} />
          <p>
            <b>Demo data.</b> Set <code>FIRECRAWL_API_KEY</code>, <code>APIFY_API_TOKEN</code> and{" "}
            <code>ANTHROPIC_API_KEY</code> to let the agents research live products.
          </p>
        </div>
      )}

      {/* Strategy analysis */}
      {a && (
        <section className="panel">
          <p className="panel-h">
            <Icons.spark size={13} /> AI strategy analysis
            <span className="panel-meta">Strategy Analyst agent</span>
          </p>
          <p className="analysis-summary">{a.summary}</p>
          <div className="analysis-grid">
            <AnalysisBlock icon="globe" title="Positioning">
              <p className="analysis-text">{a.positioning}</p>
            </AnalysisBlock>
            <AnalysisBlock icon="trending" title="Suggested price">
              <p className="analysis-price">{a.suggestedPrice}</p>
            </AnalysisBlock>
            <AnalysisBlock icon="spark" title="Differentiation">
              <AnalysisList items={a.differentiation} tone="low" />
            </AnalysisBlock>
            <AnalysisBlock icon="alert" title="Risks to watch">
              <AnalysisList items={a.risks} tone="med" />
            </AnalysisBlock>
          </div>
          {a.nextSteps.length > 0 && (
            <AnalysisBlock icon="check" title="Recommended next steps">
              <ol className="next-steps">
                {a.nextSteps.map((s, i) => (
                  <li key={i}>
                    <span className="next-step-num">{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </AnalysisBlock>
          )}
        </section>
      )}

      {/* Agent activity */}
      <section>
        <p className="panel-h section-h">
          <Icons.pulse size={13} /> Agent activity
        </p>
        <div className="agent-activity-grid">
          {result.agents.map((ag) => (
            <div key={ag.id} className="panel agent-activity">
              <div className="agent-activity-top">
                <p className="agent-activity-name">{ag.name}</p>
                {ag.status === "complete" ? (
                  <span className="badge low">
                    <span className="dot" /> done
                  </span>
                ) : ag.status === "skipped" ? (
                  <span className="badge">skipped</span>
                ) : (
                  <span className="badge high">
                    <span className="dot" /> error
                  </span>
                )}
              </div>
              <p className="agent-activity-detail">{ag.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Enriched understanding */}
      <section className="panel">
        <p className="panel-h">
          <Icons.box size={13} /> Enriched understanding
        </p>
        <p className="analysis-text">{result.enrichment.summary}</p>
        <div className="enrich-grid">
          <InfoRow icon="box" label="Suggested category" value={result.enrichment.suggestedCategory} />
          <InfoRow icon="grid" label="Target audience" value={result.enrichment.targetAudience} />
          {result.classification?.productClass && (
            <InfoRow icon="search" label="Product class" value={result.classification.productClass} />
          )}
        </div>
        {result.enrichment.tags.length > 0 && (
          <div className="enrich-tags">
            {result.enrichment.tags.map((t) => (
              <span key={t} className="cat-chip">
                #{t}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Benchmark */}
      <section>
        <p className="panel-h section-h">
          <Icons.trending size={13} /> Market benchmark
        </p>
        <BenchmarkTable competitors={result.benchmark.competitors} />
      </section>

      {/* Makers */}
      {result.makers?.length ? (
        <section>
          <p className="panel-h section-h">
            <Icons.building size={13} /> Who&apos;s making it
          </p>
          <div className="maker-grid">
            {result.makers.map((m) => (
              <div key={m.name} className="panel maker-card">
                <div className="maker-id">
                  <p className="maker-name">{m.name}</p>
                  <p className="maker-offers">
                    {m.offers} listing{m.offers === 1 ? "" : "s"}
                  </p>
                </div>
                {m.lowestPrice && <span className="maker-price">from {m.lowestPrice}</span>}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Suppliers */}
      {result.suppliers?.length ? (
        <section>
          <p className="panel-h section-h">
            <Icons.factory size={13} /> Suppliers &amp; manufacturers
          </p>
          <div className="supplier-grid">
            {result.suppliers.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="panel supplier-card">
                <div className="supplier-top">
                  <span className="supplier-name">
                    {s.name}
                    <Icons.arrowUpRight size={13} />
                  </span>
                  {s.source === "aliexpress" && <span className="badge med">AliExpress</span>}
                </div>
                {(s.price || s.orders != null || s.rating != null) && (
                  <div className="supplier-meta">
                    {s.price && <span className="supplier-price">{s.price}</span>}
                    {s.rating != null && <span>★ {s.rating}</span>}
                    {s.orders != null && <span>{s.orders.toLocaleString()} orders</span>}
                  </div>
                )}
                {s.snippet && <p className="supplier-snippet">{s.snippet}</p>}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {/* Insights */}
      {result.benchmark.insights.length > 0 && (
        <section className="panel em-panel">
          <p className="panel-h">
            <Icons.spark size={13} /> Insights
          </p>
          <ul className="dp-why">
            {result.benchmark.insights.map((ins, i) => (
              <li key={i}>
                <Icons.check size={14} />
                {ins}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Sources */}
      {result.sources.length > 0 && (
        <section>
          <p className="panel-h section-h">
            <Icons.search size={13} /> Sources
          </p>
          <ul className="source-list">
            {result.sources.map((s, i) => (
              <li key={i}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="link-btn">
                  <Icons.arrowUpRight size={13} />
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="idea-foot-note">
        Submitted {new Date(idea.createdAt).toLocaleDateString()}
        {idea.submittedBy ? ` · ${idea.submittedBy}` : ""} · research ran{" "}
        {new Date(result.ranAt).toLocaleString()}
      </p>
    </div>
  );
}

function BenchmarkTable({ competitors }: { competitors: ResearchResult["benchmark"]["competitors"] }) {
  if (!competitors.length) {
    return <div className="empty">No comparable products were found.</div>;
  }
  return (
    <div className="tablewrap">
      <table className="dtable">
        <thead>
          <tr>
            <th>Product</th>
            <th>Brand / source</th>
            <th>Price</th>
            <th>Rating</th>
            <th>Key features</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {competitors.map((c, i) => (
            <tr key={(c.url || c.name) + i} className="no-cursor">
              <td className="td-cat">{c.name}</td>
              <td>
                <div>{c.brand || "—"}</div>
                <div className="td-source">{c.source}</div>
              </td>
              <td className="mono">{c.price || "—"}</td>
              <td className="mono">
                {c.rating != null ? (
                  <>
                    ★ {c.rating}
                    {c.reviews != null && <span className="td-source"> ({c.reviews.toLocaleString()})</span>}
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td>
                {c.features.length ? (
                  <div className="feat-chips">
                    {c.features.map((f, j) => (
                      <span key={j} className="feat-chip">
                        {f}
                      </span>
                    ))}
                  </div>
                ) : (
                  "—"
                )}
              </td>
              <td className="r">
                {c.url ? (
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="link-btn">
                    View <Icons.arrowUpRight size={12} />
                  </a>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnalysisBlock({
  icon,
  title,
  children,
}: {
  icon: keyof typeof Icons;
  title: string;
  children: React.ReactNode;
}) {
  const Icon = Icons[icon];
  return (
    <div className="analysis-block">
      <p className="analysis-block-h">
        <Icon size={13} />
        {title}
      </p>
      {children}
    </div>
  );
}

function AnalysisList({ items, tone }: { items: string[]; tone: "low" | "med" }) {
  if (!items.length) return <p className="analysis-text muted">—</p>;
  return (
    <ul className="analysis-list">
      {items.map((item, i) => (
        <li key={i}>
          <span className={cc("analysis-dot", tone)} />
          {item}
        </li>
      ))}
    </ul>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Icons; label: string; value: string }) {
  const Icon = Icons[icon];
  return (
    <div className="info-row">
      <span className="info-row-icon">
        <Icon size={15} />
      </span>
      <div>
        <p className="info-row-label">{label}</p>
        <p className="info-row-value">{value}</p>
      </div>
    </div>
  );
}
