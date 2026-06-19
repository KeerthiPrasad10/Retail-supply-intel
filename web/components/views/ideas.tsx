"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductIdea, ResearchResult } from "@/lib/ideas/types";
import type { Go, Trend } from "@/lib/types";
import { resizeImage } from "@/lib/image";
import { cc, fmtPct } from "@/lib/util";
import { Icons } from "../icons";
import { useModel } from "../model-context";
import { Tier } from "../primitives";
import { IdeaComments } from "./idea-comments";
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

const MAX_IMAGE_BYTES = 15_000_000; // 15 MB — accommodates full-res iPhone photos

const PIPELINE = [
  { id: "classify", name: "Classifier", desc: "Classifying the product & deriving search terms…", icon: "spark" as const },
  { id: "stores", name: "Online Stores", desc: "Scanning Amazon for live listings & prices…", icon: "box" as const },
  { id: "web", name: "Web Research", desc: "Searching the web for similar products…", icon: "search" as const },
  { id: "demand", name: "Demand Signals", desc: "Reading Reddit & Hacker News from the last 30 days…", icon: "pulse" as const },
  { id: "suppliers", name: "China Suppliers", desc: "Finding AliExpress & web suppliers…", icon: "factory" as const },
  { id: "analyst", name: "Strategy Analyst", desc: "Synthesising positioning, pricing & next steps…", icon: "trending" as const },
];

type Stage = "board" | "form" | "running" | "detail" | "error";

export function Ideas({ go, resetSignal }: { go: Go; resetSignal: number }) {
  const { trends } = useModel();
  const [stage, setStage] = useState<Stage>("board");
  const [idea, setIdea] = useState<ProductIdea | null>(null);
  const [selectedIdea, setSelectedIdea] = useState<ProductIdea | null>(null);
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

  // Clicking "Product Ideas" in the nav always returns to the board.
  // Skip the first run so it doesn't clobber the initial mount.
  const firstReset = useRef(true);
  useEffect(() => {
    if (firstReset.current) {
      firstReset.current = false;
      return;
    }
    setStage("board");
    setSelectedIdea(null);
    setIdea(null);
    setError(null);
    loadRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

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

      const res = await fetch(`/api/ideas/${newIdea.id}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: newIdea }),
      });
      const data = await res.json();
      if (!res.ok && !data?.idea) throw new Error(data?.error || "Research failed.");
      const research: ResearchResult | undefined = data?.idea?.research;
      clearInterval(stepTimer.current);
      if (!research || research.error) {
        setError(research?.error || "Research did not complete.");
        setStage("error");
        return;
      }
      const finalIdea: ProductIdea = data?.idea ?? newIdea;
      loadRecent();
      setSelectedIdea(finalIdea);
      setStage("detail");
    } catch (err) {
      clearInterval(stepTimer.current);
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStage("error");
    }
  }

  function viewIdea(i: ProductIdea) {
    if (!i.research) return;
    setSelectedIdea(i);
    setStage("detail");
  }

  return (
    <div className="content">
      <header className="page-head">
        <div>
          <h1 className="page-title">Product Ideas</h1>
          <p className="page-sub">
            Research ideas submitted by the team — click any card to see market analysis
          </p>
        </div>
        {stage === "board" ? (
          <button className="btn primary sm" onClick={() => setStage("form")}>
            <Icons.plus size={14} /> Add idea
          </button>
        ) : (
          <button className="btn secondary sm" onClick={() => setStage("board")}>
            <Icons.arrowLeft size={14} /> Board
          </button>
        )}
      </header>

      {stage === "board" && (
        <BoardView ideas={recent} onView={viewIdea} onAdd={() => setStage("form")} />
      )}

      {stage === "form" && (
        <SubmitForm imageUrlRef={imageUrlRef} onSubmit={submit} />
      )}

      {stage === "running" && idea && <RunningView idea={idea} activeStep={activeStep} />}

      {stage === "detail" && selectedIdea?.research && (
        <Results idea={selectedIdea} result={selectedIdea.research} trends={trends} go={go} />
      )}

      {stage === "error" && (
        <div className="callout warn">
          <Icons.alert size={15} />
          <p>{error || "Research failed to complete. Please try again."}</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Board view ------------------------------ */

const STATUS_BADGE: Record<ProductIdea["status"], { cls: string; label: string }> = {
  queued: { cls: "", label: "queued" },
  researching: { cls: "med", label: "researching" },
  complete: { cls: "low", label: "complete" },
  error: { cls: "high", label: "error" },
};

function EmptyBoard({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="ideas-board-empty">
      <div className="ideas-board-empty-icon">
        <Icons.box size={24} />
      </div>
      <p className="ideas-board-empty-title">No ideas yet</p>
      <p className="ideas-board-empty-sub">Submit a product idea and AI agents will research the live market for you.</p>
      <button className="btn primary sm" onClick={onAdd}>
        <Icons.plus size={14} /> Add idea
      </button>
    </div>
  );
}

function IdeaCard({ idea, onClick }: { idea: ProductIdea; onClick: () => void }) {
  const s = STATUS_BADGE[idea.status] ?? STATUS_BADGE.queued;
  const clickable = !!idea.research;
  const dateStr = new Date(idea.createdAt).toLocaleDateString();
  const category =
    idea.research?.classification?.category ||
    idea.research?.enrichment?.suggestedCategory ||
    idea.category;
  const snippet =
    idea.research?.analysis?.summary?.slice(0, 100) ||
    idea.description?.slice(0, 100);

  return (
    <div className={cc("idea-card", clickable && "clickable")} onClick={clickable ? onClick : undefined}>
      <div className="idea-card-image">
        {idea.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={idea.imageUrl} alt={idea.title} />
        ) : (
          <Icons.box size={28} />
        )}
      </div>
      <div className="idea-card-body">
        <div className="idea-card-chips">
          {category && <span className="cat-chip">{category}</span>}
          <span className={cc("badge", s.cls)}>
            {(idea.status === "complete" || idea.status === "researching") && <span className="dot" />}
            {s.label}
          </span>
        </div>
        <p className="idea-card-title">{idea.title}</p>
        {snippet && <p className="idea-card-snippet">{snippet}{snippet.length >= 100 ? "…" : ""}</p>}
        <div className="idea-card-foot">
          <span className="idea-card-date">{dateStr}</span>
          {idea.submittedBy && <span className="idea-card-date">{idea.submittedBy}</span>}
        </div>
      </div>
    </div>
  );
}

function BoardView({ ideas, onView, onAdd }: { ideas: ProductIdea[]; onView: (i: ProductIdea) => void; onAdd: () => void }) {
  if (!ideas.length) return <EmptyBoard onAdd={onAdd} />;
  return (
    <div className="ideas-board">
      {ideas.map((idea) => (
        <IdeaCard key={idea.id} idea={idea} onClick={() => idea.research && onView(idea)} />
      ))}
    </div>
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
  const uploadPromiseRef = useRef<Promise<string> | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [autofill, setAutofill] = useState<AutofillState>("idle");
  const [fields, setFields] = useState<IdeaFields>(EMPTY_FIELDS);
  const [formError, setFormError] = useState<string | null>(null);

  function setField(key: keyof IdeaFields, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function uploadImage(dataUrl: string): Promise<string> {
    try {
      const res = await fetch("/api/ideas/upload-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: dataUrl }),
      });
      if (!res.ok) return dataUrl;
      const data = await res.json();
      return typeof data.url === "string" ? data.url : dataUrl;
    } catch {
      return dataUrl;
    }
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
      setFormError("Image is too large (max 15 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = String(reader.result || "");
      setImagePreview(raw);
      const resized = await resizeImage(raw);
      imageUrlRef.current = resized; // keep data URL for preview + analyse-image
      // Upload to Storage in parallel; swap in the real URL when ready.
      uploadPromiseRef.current = uploadImage(resized);
      uploadPromiseRef.current.then((url) => {
        if (url?.startsWith("http")) imageUrlRef.current = url;
      });
      analyseImage(resized);
    };
    reader.readAsDataURL(file);
  }

  function removeImage() {
    setImagePreview("");
    imageUrlRef.current = "";
    uploadPromiseRef.current = null;
    setAutofill("idle");
    setFields(EMPTY_FIELDS);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!fields.title.trim()) {
      setFormError("Please give your product idea a title.");
      return;
    }
    // Wait for the in-flight Storage upload so the real URL is ready.
    if (uploadPromiseRef.current) {
      try {
        const url = await uploadPromiseRef.current;
        if (url?.startsWith("http")) imageUrlRef.current = url;
      } catch {}
    }
    const payload: Record<string, string> = { ...fields };
    if (imageUrlRef.current.startsWith("http")) payload.imageUrl = imageUrlRef.current;
    onSubmit(payload);
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
          <p className="idea-banner-title">Researching &ldquo;{idea.title}&rdquo;</p>
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

/* ------------------------------ Image carousel ------------------------------ */

function ImageCarousel({ idea, renderings }: { idea: ProductIdea; renderings?: import("@/lib/ideas/types").Rendering[] }) {
  const slides: { url: string; label: string }[] = [];
  if (idea.imageUrl?.startsWith("http")) slides.push({ url: idea.imageUrl, label: "Original" });
  (renderings ?? []).forEach((r) => slides.push({ url: r.url, label: r.scene }));

  const [idx, setIdx] = useState(0);
  const safeIdx = Math.min(idx, Math.max(0, slides.length - 1));

  if (slides.length === 0) return null;

  return (
    <section className="img-carousel-wrap">
      <p className="panel-h section-h">
        <Icons.image size={13} /> Product images
        <span className="panel-meta">{slides.length} image{slides.length !== 1 ? "s" : ""}</span>
      </p>
      <div className="img-carousel">
        <div className="img-carousel-stage">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slides[safeIdx].url} alt={slides[safeIdx].label} className="img-carousel-img" />
          <span className="img-carousel-badge badge">{slides[safeIdx].label}</span>
          {slides.length > 1 && (
            <>
              <button
                type="button"
                className="img-carousel-arrow left"
                onClick={() => setIdx((i) => (i - 1 + slides.length) % slides.length)}
                aria-label="Previous"
              >
                <Icons.chevronLeft size={16} />
              </button>
              <button
                type="button"
                className="img-carousel-arrow right"
                onClick={() => setIdx((i) => (i + 1) % slides.length)}
                aria-label="Next"
              >
                <Icons.arrowRight size={16} />
              </button>
            </>
          )}
        </div>
        {slides.length > 1 && (
          <div className="img-carousel-thumbs">
            {slides.map((s, i) => (
              <button
                key={i}
                type="button"
                className={cc("img-carousel-thumb", i === safeIdx && "active")}
                onClick={() => setIdx(i)}
                aria-label={s.label}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.url} alt={s.label} />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------ Results ------------------------------ */

function tokenize(...parts: (string | undefined | null)[]): Set<string> {
  const out = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const raw of part.split(/[^a-z0-9]+/i)) {
      const t = raw.toLowerCase();
      if (t.length >= 3) out.add(t);
    }
  }
  return out;
}

function relatedTrends(idea: ProductIdea, result: ResearchResult, trends: Trend[]): Trend[] {
  const tokens = tokenize(
    idea.category,
    idea.title,
    result.classification?.category,
    ...(result.classification?.keywords ?? []),
    result.enrichment?.suggestedCategory,
  );
  if (tokens.size === 0) return [];
  const scored = trends
    .map((t) => {
      const hay = t.cat.toLowerCase();
      let score = 0;
      for (const tok of tokens) if (hay.includes(tok)) score++;
      return { t, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((x) => x.t);
}

function Results({
  idea,
  result,
  trends,
  go,
}: {
  idea: ProductIdea;
  result: ResearchResult;
  trends: Trend[];
  go: Go;
}) {
  const pr = result.benchmark.priceRange;
  const fmt = (n: number) => `${pr?.currency === "USD" ? "$" : (pr?.currency || "$") + " "}${Math.round(n)}`;
  const a = result.analysis;
  const related = relatedTrends(idea, result, trends);

  return (
    <div className="ideas-results">
      {/* 1. Stat row */}
      <div className="stat-row">
        <StatTile value={result.benchmark.competitors.length} label="Products benchmarked" sub="across stores & web" />
        <StatTile value={result.suppliers?.length ?? 0} label="Suppliers found" sub="China + web sourcing" />
        <StatTile
          value={pr ? fmt(pr.avg) : "—"}
          label="Avg market price"
          sub={pr ? `${fmt(pr.min)} – ${fmt(pr.max)}` : "no pricing extracted"}
          accent
        />
        {result.demand && result.demand.totalPosts > 0 ? (
          <StatTile
            value={result.demand.momentum.charAt(0).toUpperCase() + result.demand.momentum.slice(1)}
            label="Demand momentum"
            sub={`${result.demand.totalPosts} posts · ${result.demand.totalEngagement.toLocaleString()} engagements`}
          />
        ) : (
          <StatTile
            value={result.mode === "live" ? "Live" : "Demo"}
            label="Research mode"
            sub={result.mode === "live" ? `${(result.durationMs / 1000).toFixed(1)}s` : "set API keys for live data"}
          />
        )}
      </div>

      {/* 2. Demo callout */}
      {result.mode === "demo" && (
        <div className="callout warn">
          <Icons.alert size={15} />
          <p>
            <b>Demo data.</b> Set <code>FIRECRAWL_API_KEY</code>, <code>APIFY_API_TOKEN</code> and{" "}
            <code>ANTHROPIC_API_KEY</code> to let the agents research live products.
          </p>
        </div>
      )}

      {/* 3. AI strategy analysis */}
      {a ? (
        <section className="panel">
          <p className="panel-h">
            <Icons.spark size={13} /> AI strategy analysis
            <span className="panel-meta">Strategy Analyst</span>
          </p>
          <p className="analysis-summary">{a.summary}</p>
          <div className="analysis-row">
            <span className="analysis-pill">
              <Icons.globe size={12} /> {a.positioning}
            </span>
            <span className="analysis-pill accent">
              <Icons.trending size={12} /> Suggested: {a.suggestedPrice}
            </span>
          </div>
          {(a.differentiation.length > 0 || a.risks.length > 0) && (
            <div className="analysis-grid">
              {a.differentiation.length > 0 && (
                <AnalysisBlock icon="spark" title="Differentiation">
                  <AnalysisList items={a.differentiation.slice(0, 3)} tone="low" />
                </AnalysisBlock>
              )}
              {a.risks.length > 0 && (
                <AnalysisBlock icon="alert" title="Risks">
                  <AnalysisList items={a.risks.slice(0, 3)} tone="med" />
                </AnalysisBlock>
              )}
            </div>
          )}
          {a.nextSteps.length > 0 && (
            <div className="next-steps-row">
              {a.nextSteps.slice(0, 3).map((s, i) => (
                <span key={i} className="next-step-pill">
                  <span className="next-step-num">{i + 1}</span>
                  {s}
                </span>
              ))}
            </div>
          )}
        </section>
      ) : result.enrichment.summary ? (
        <section className="panel">
          <p className="panel-h"><Icons.spark size={13} /> Summary</p>
          <p className="analysis-summary">{result.enrichment.summary}</p>
        </section>
      ) : null}

      {/* 4. Product image carousel — original photo + AI renderings */}
      <ImageCarousel idea={idea} renderings={result.renderings} />

      {/* 5. Related market trends — connective tissue to the trends dashboard */}
      <section>
        <p className="panel-h section-h">
          <Icons.trending size={13} /> Related market trends
        </p>
        {related.length > 0 ? (
          <div className="related-trends-grid">
            {related.map((t) => (
              <button
                key={t.id}
                type="button"
                className="related-trend-card"
                onClick={() => go("deepdive", t.id)}
              >
                <div className="related-trend-top">
                  <Tier tier={t.tier} />
                  <Icons.arrowUpRight size={13} />
                </div>
                <p className="related-trend-cat">{t.cat}</p>
                <p className="related-trend-market">{t.market}</p>
                <div className="related-trend-foot">
                  <span className="related-trend-stat">
                    Momentum <b>{Math.round(t.momentum)}</b>
                  </span>
                  <span className={cc("growth", t.growth >= 0 ? "up" : "down")}>
                    {fmtPct(t.growth)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="analysis-text muted related-trend-empty">
            Explore the live market-trends dashboard for category context.
          </p>
        )}
        <button type="button" className="btn secondary sm related-trend-all" onClick={() => go("trending")}>
          View all market trends <Icons.arrowUpRight size={13} />
        </button>
      </section>

      {/* 6. Demand signals — real community discussion (last 30 days) */}
      {result.demand && result.demand.posts.length > 0 && (
        <section>
          <p className="panel-h section-h">
            <Icons.pulse size={13} /> Demand signals
            <span className="panel-meta">
              {result.demand.momentum} momentum · {result.demand.channels.slice(0, 4).join(", ")}
            </span>
          </p>
          <div className="demand-grid">
            {result.demand.posts.slice(0, 4).map((p, i) => (
              <a
                key={i}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="panel demand-card"
              >
                <div className="demand-card-top">
                  <span className={cc("badge", p.source === "reddit" ? "med" : "")}>{p.channel}</span>
                  <span className="demand-eng">
                    <Icons.trending size={12} /> {p.engagement.toLocaleString()}
                  </span>
                </div>
                <p className="demand-title">{p.title}</p>
                <p className="demand-meta">
                  {p.comments.toLocaleString()} comments · {new Date(p.createdAt).toLocaleDateString()}
                  <Icons.arrowUpRight size={12} />
                </p>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* 7. Market benchmark */}
      <section>
        <p className="panel-h section-h">
          <Icons.trending size={13} /> Market benchmark
        </p>
        <BenchmarkTable competitors={result.benchmark.competitors} />
      </section>

      {/* 8a. Makers — who's making it */}
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

      {/* 8b. Suppliers & manufacturers */}
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

      {/* 9. Enrichment tags */}
      {result.enrichment.tags.length > 0 && (
        <div className="enrich-tags">
          {result.enrichment.tags.map((t) => (
            <span key={t} className="cat-chip">#{t}</span>
          ))}
        </div>
      )}

      {/* 13. Feedback & comments */}
      <IdeaComments ideaId={idea.id} />

      {/* 14. Foot note */}
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
