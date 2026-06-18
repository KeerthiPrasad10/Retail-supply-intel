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
          <h1 className="page-title">Validate a product idea</h1>
          <p className="page-sub">
            Submit a product concept and a panel of AI agents benchmark it against the live market —{" "}
            <b>classification, store &amp; competitor benchmark, China + web suppliers, and a strategy
            analysis</b> with positioning, pricing and next steps.
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
        <>
          <SubmitForm imageUrlRef={imageUrlRef} onSubmit={submit} />
          <RecentIdeas ideas={recent} onView={viewIdea} />
        </>
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

function SubmitForm({
  imageUrlRef,
  onSubmit,
}: {
  imageUrlRef: React.MutableRefObject<string>;
  onSubmit: (payload: Record<string, string>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function setImg(v: string) {
    setImageUrl(v);
    setImagePreview(v);
    imageUrlRef.current = v;
  }

  function handleFile(file?: File) {
    setFormError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFormError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setFormError("Image is too large (max 1.5 MB). Try a smaller file or paste an image URL.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImg(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const form = new FormData(e.currentTarget);
    const payload: Record<string, string> = {
      title: String(form.get("title") || ""),
      description: String(form.get("description") || ""),
      category: String(form.get("category") || ""),
      targetMarket: String(form.get("targetMarket") || ""),
      audience: String(form.get("audience") || ""),
      priceTarget: String(form.get("priceTarget") || ""),
      features: String(form.get("features") || ""),
      submittedBy: String(form.get("submittedBy") || ""),
      imageUrl: imageUrlRef.current,
    };
    if (!payload.title.trim()) {
      setFormError("Please give your product idea a title.");
      return;
    }
    onSubmit(payload);
  }

  return (
    <div className="ideas-form-grid">
      <form className="panel idea-form" onSubmit={handleSubmit}>
        <Field label="Product idea title" required hint="A short, descriptive name.">
          <input
            name="title"
            required
            placeholder="e.g. Insulated stainless steel kids' water bottle"
            className="nxb-input"
          />
        </Field>

        <Field label="Describe the idea" required hint="What is it, what problem does it solve, what makes it different?">
          <textarea
            name="description"
            required
            rows={4}
            placeholder="Describe the product, its purpose and any standout features…"
            className="nxb-input"
          />
        </Field>

        <div className="field-row">
          <Field label="Category">
            <input name="category" list="ideas-category-options" placeholder="Choose or type a category" className="nxb-input" />
            <datalist id="ideas-category-options">
              {CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Target price" hint="Used to position against the market.">
            <input name="priceTarget" placeholder="e.g. $30–45" className="nxb-input" />
          </Field>
        </div>

        <div className="field-row">
          <Field label="Target market">
            <input name="targetMarket" placeholder="e.g. Australia, UK" className="nxb-input" />
          </Field>
          <Field label="Target audience">
            <input name="audience" placeholder="e.g. Parents of toddlers" className="nxb-input" />
          </Field>
        </div>

        <Field label="Key features" hint="One per line or comma-separated — helps agents benchmark.">
          <textarea name="features" rows={3} placeholder={"Leak-proof lid\nBPA-free\nHolds 500ml"} className="nxb-input" />
        </Field>

        <Field label="Reference image" hint="Optional — upload a sketch/photo or paste an image URL.">
          <div
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFile(e.dataTransfer.files?.[0]);
            }}
          >
            {imagePreview ? (
              <div className="dropzone-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Preview" className="dropzone-thumb" />
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setImg("");
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  <Icons.x size={14} /> Remove
                </button>
              </div>
            ) : (
              <button type="button" className="dropzone-btn" onClick={() => fileRef.current?.click()}>
                <Icons.box size={20} />
                <span className="dropzone-main">Click to upload or drag &amp; drop</span>
                <span className="dropzone-sub">PNG/JPG up to 1.5 MB</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden-input"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <input
              className="nxb-input dropzone-url"
              value={imageUrl.startsWith("data:") ? "" : imageUrl}
              onChange={(e) => setImg(e.target.value)}
              placeholder="…or paste an image URL"
            />
          </div>
        </Field>

        <Field label="Your name / team" hint="Optional.">
          <input name="submittedBy" placeholder="e.g. Priya, Product team" className="nxb-input" />
        </Field>

        {formError && (
          <div className="callout warn">
            <Icons.alert size={15} />
            <p>{formError}</p>
          </div>
        )}

        <div className="idea-form-foot">
          <button type="submit" className="btn primary">
            <Icons.spark size={15} />
            Submit &amp; run agents
          </button>
          <span className="idea-form-note">Agents start researching as soon as you submit.</span>
        </div>
      </form>

      <aside className="panel idea-aside">
        <p className="panel-h">
          <Icons.spark size={13} /> What happens next
        </p>
        <p className="idea-aside-lead">As soon as you submit, the research agents start working:</p>
        <ul className="agent-steps">
          {PIPELINE.map((a) => {
            const Icon = Icons[a.icon];
            return (
              <li key={a.id} className="agent-step">
                <span className="agent-step-icon">
                  <Icon size={15} />
                </span>
                <div>
                  <p className="agent-step-name">{a.name}</p>
                  <p className="agent-step-desc">{a.desc}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
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
