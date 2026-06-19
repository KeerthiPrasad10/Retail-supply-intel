"use client";

import { useRef, useState } from "react";
import type { ProductIdea } from "@/lib/ideas/types";
import { resizeImage } from "@/lib/image";
import { cc } from "@/lib/util";
import { Icons } from "./icons";

const STEPS = [
  { icon: "spark" as const,   label: "Classifying product",        detail: "Deriving category, search terms & HS codes…" },
  { icon: "search" as const,  label: "Scanning online stores",     detail: "Checking Amazon listings & live prices…" },
  { icon: "pulse" as const,   label: "Web research",               detail: "Finding similar products & market signals…" },
  { icon: "factory" as const, label: "Finding suppliers",          detail: "Searching AliExpress & B2B directories…" },
  { icon: "box" as const,     label: "Strategy analysis",          detail: "Synthesising positioning, pricing & next steps…" },
];

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

const EMPTY: IdeaFields = {
  title: "",
  description: "",
  category: "",
  features: "",
  priceTarget: "",
  targetMarket: "",
  audience: "",
  submittedBy: "",
};

type Stage = "form" | "submitting" | "done" | "error";

export function SubmitIdeaPage() {
  const [stage, setStage] = useState<Stage>("form");
  const [doneIdea, setDoneIdea] = useState<ProductIdea | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const stepTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  function startSteps() {
    setActiveStep(0);
    clearInterval(stepTimer.current);
    stepTimer.current = setInterval(() => {
      setActiveStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 4000);
  }

  function reset() {
    clearInterval(stepTimer.current);
    setStage("form");
    setActiveStep(0);
    setDoneIdea(null);
    setError(null);
  }

  async function handleSubmit(payload: Record<string, string>) {
    setError(null);
    setStage("submitting");
    startSteps();
    try {
      const createRes = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const created = await createRes.json();
      if (!createRes.ok) throw new Error(created?.error || "Could not submit the idea.");
      const newIdea: ProductIdea = created.idea;

      const resRes = await fetch(`/api/ideas/${newIdea.id}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: newIdea }),
      });
      const resData = await resRes.json();
      const finalIdea: ProductIdea = resData?.idea ?? newIdea;
      clearInterval(stepTimer.current);
      setDoneIdea(finalIdea);
      setStage("done");
    } catch (err) {
      clearInterval(stepTimer.current);
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStage("error");
    }
  }

  if (stage === "submitting") {
    return <SubmittingView activeStep={activeStep} />;
  }

  if (stage === "done" && doneIdea) {
    return <SuccessView idea={doneIdea} onReset={reset} />;
  }

  return (
    <FormView
      onSubmit={handleSubmit}
      error={stage === "error" ? (error ?? "Something went wrong.") : null}
      onClearError={() => { setStage("form"); setError(null); }}
    />
  );
}

/* ------------------------------ Submitting view ------------------------------ */

function SubmittingView({ activeStep }: { activeStep: number }) {
  return (
    <div className="sp-shell">
      <div className="sp-submitting">
        <span className="sp-spinner-wrap">
          <span className="spinner sp-spinner" aria-hidden />
        </span>
        <p className="sp-submitting-title">Researching your idea&hellip;</p>
        <p className="sp-submitting-sub">AI agents are working in parallel — this takes about 30 seconds.</p>
        <ol className="sp-steps">
          {STEPS.map((step, i) => {
            const done = i < activeStep;
            const active = i === activeStep;
            const StepIcon = Icons[step.icon];
            return (
              <li key={step.label} className={cc("sp-step", done && "done", active && "active")}>
                <span className="sp-step-icon">
                  {done
                    ? <Icons.check size={14} />
                    : active
                      ? <span className="spinner" aria-hidden />
                      : <StepIcon size={14} />}
                </span>
                <span className="sp-step-text">
                  <span className="sp-step-label">{step.label}</span>
                  {active && <span className="sp-step-detail">{step.detail}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/* ------------------------------ Success view ------------------------------ */

function SuccessView({ idea, onReset }: { idea: ProductIdea; onReset: () => void }) {
  return (
    <div className="sp-shell">
      <div className="sp-success panel">
        <span className="sp-success-icon">
          <Icons.check size={22} />
        </span>
        <h1 className="sp-success-title">Idea added to the product board</h1>
        <p className="sp-success-name">{idea.title}</p>
        {idea.category ? <span className="cat-chip sp-cat">{idea.category}</span> : null}
        <button className="btn primary sp-reset-btn" onClick={onReset}>
          <Icons.plus size={15} />
          Submit another
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ Form view ------------------------------ */

function FormView({
  onSubmit,
  error,
  onClearError,
}: {
  onSubmit: (payload: Record<string, string>) => void;
  error: string | null;
  onClearError: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const imageUrlRef = useRef("");
  const [imagePreview, setImagePreview] = useState("");
  const [autofill, setAutofill] = useState<AutofillState>("idle");
  const [fields, setFields] = useState<IdeaFields>(EMPTY);
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
      setImagePreview(raw); // show full-res preview immediately
      const resized = await resizeImage(raw);
      imageUrlRef.current = resized;
      analyseImage(resized);
    };
    reader.readAsDataURL(file);
  }

  function removeImage() {
    setImagePreview("");
    imageUrlRef.current = "";
    setAutofill("idle");
    setFields(EMPTY);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    onClearError();
    if (!fields.title.trim()) {
      setFormError("Please give your product idea a title.");
      return;
    }
    onSubmit({ ...fields, imageUrl: imageUrlRef.current });
  }

  const isAnalysing = autofill === "loading";
  const af = autofill === "done";

  return (
    <div className="sp-shell">
      <header className="sp-header">
        <span className="sp-logo">RSI</span>
        <p className="sp-header-sub">Submit a product idea</p>
      </header>

      <form className="sp-form panel" onSubmit={handleSubmit} noValidate>
        <div
          className={cc("idea-image-zone sp-zone", imagePreview && "has-image")}
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
                    <span className="spinner" aria-hidden /> Analysing…
                  </span>
                )}
                {autofill === "done" && (
                  <span className="idea-analyse-badge done">
                    <Icons.check size={12} /> Fields filled by AI
                  </span>
                )}
                {autofill === "error" && (
                  <span className="idea-analyse-badge warn">
                    <Icons.alert size={12} /> Fill manually
                  </span>
                )}
                <button type="button" className="idea-image-remove" onClick={removeImage}>
                  <Icons.x size={14} /> Change
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
                <Icons.box size={36} />
              </span>
              <span className="idea-image-drop-main">Tap to add a product photo</span>
              <span className="idea-image-drop-sub">AI fills the form for you · PNG/JPG · or fill in below</span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden-input"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>

        <fieldset className={cc("idea-fields sp-fields", isAnalysing && "sp-shimmer")} disabled={isAnalysing}>
          <label className="field">
            <span className="field-label">Product title <span className="field-req">*</span></span>
            <div className="field-control">
              <input
                value={fields.title}
                onChange={(e) => setField("title", e.target.value)}
                required
                placeholder="e.g. Insulated stainless steel kids' water bottle"
                className={cc("nxb-input", af && fields.title && "autofilled")}
              />
            </div>
          </label>

          <label className="field">
            <span className="field-label">Description</span>
            <span className="field-hint">What it is, who it&apos;s for, what makes it different.</span>
            <div className="field-control">
              <textarea
                value={fields.description}
                onChange={(e) => setField("description", e.target.value)}
                rows={3}
                placeholder="Describe the product…"
                className={cc("nxb-input", af && fields.description && "autofilled")}
              />
            </div>
          </label>

          <label className="field">
            <span className="field-label">Category</span>
            <div className="field-control">
              <input
                value={fields.category}
                onChange={(e) => setField("category", e.target.value)}
                list="sp-category-options"
                placeholder="Choose or type…"
                className={cc("nxb-input", af && fields.category && "autofilled")}
              />
              <datalist id="sp-category-options">
                {CATEGORIES.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          </label>

          <label className="field">
            <span className="field-label">Target price</span>
            <div className="field-control">
              <input
                value={fields.priceTarget}
                onChange={(e) => setField("priceTarget", e.target.value)}
                placeholder="e.g. $30–45"
                className={cc("nxb-input", af && fields.priceTarget && "autofilled")}
              />
            </div>
          </label>

          <label className="field">
            <span className="field-label">Target market</span>
            <div className="field-control">
              <input
                value={fields.targetMarket}
                onChange={(e) => setField("targetMarket", e.target.value)}
                placeholder="e.g. Australia, UK"
                className={cc("nxb-input", af && fields.targetMarket && "autofilled")}
              />
            </div>
          </label>

          <label className="field">
            <span className="field-label">Target audience</span>
            <div className="field-control">
              <input
                value={fields.audience}
                onChange={(e) => setField("audience", e.target.value)}
                placeholder="e.g. Parents of toddlers"
                className={cc("nxb-input", af && fields.audience && "autofilled")}
              />
            </div>
          </label>

          <label className="field">
            <span className="field-label">Key features</span>
            <span className="field-hint">One per line.</span>
            <div className="field-control">
              <textarea
                value={fields.features}
                onChange={(e) => setField("features", e.target.value)}
                rows={3}
                placeholder={"Leak-proof lid\nBPA-free\nHolds 500ml"}
                className={cc("nxb-input", af && fields.features && "autofilled")}
              />
            </div>
          </label>

          <label className="field">
            <span className="field-label">Your name</span>
            <span className="field-hint">Optional.</span>
            <div className="field-control">
              <input
                value={fields.submittedBy}
                onChange={(e) => setField("submittedBy", e.target.value)}
                placeholder="e.g. Priya, Product team"
                className="nxb-input"
              />
            </div>
          </label>
        </fieldset>

        {(formError || error) && (
          <div className="callout warn">
            <Icons.alert size={15} />
            <p>{formError ?? error}</p>
          </div>
        )}

        <button type="submit" className="btn primary sp-submit" disabled={isAnalysing}>
          {isAnalysing ? (
            <><span className="spinner" aria-hidden /> Analysing image…</>
          ) : (
            <><Icons.spark size={15} /> Submit idea</>
          )}
        </button>
      </form>
    </div>
  );
}
