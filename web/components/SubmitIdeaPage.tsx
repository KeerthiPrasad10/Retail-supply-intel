"use client";

import { useRef, useState } from "react";
import type { ProductIdea } from "@/lib/ideas/types";
import { resizeImage } from "@/lib/image";
import { cc } from "@/lib/util";
import { Icons } from "./icons";
import { SimilarIdeas } from "./SimilarIdeas";


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

function isHttpUrl(s: string) {
  try { const u = new URL(s); return u.protocol === "https:" || u.protocol === "http:"; }
  catch { return false; }
}

type Stage = "form" | "submitting" | "done" | "error";

export function SubmitIdeaPage() {
  const [stage, setStage] = useState<Stage>("form");
  const [doneIdea, setDoneIdea] = useState<ProductIdea | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStage("form");
    setDoneIdea(null);
    setError(null);
  }

  async function handleSubmit(payload: Record<string, unknown>) {
    setError(null);
    setStage("submitting");
    try {
      const createRes = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const created = await createRes.json();
      if (!createRes.ok) throw new Error(created?.error || "Could not submit the idea.");
      const newIdea: ProductIdea = created.idea;

      // Fire research in the background — don't make the submitter wait.
      // Results will appear on the product board once agents complete.
      fetch(`/api/ideas/${newIdea.id}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: newIdea }),
      }).catch(() => {});

      setDoneIdea(newIdea);
      setStage("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStage("error");
    }
  }

  if (stage === "submitting") {
    return (
      <div className="sp-shell">
        <div className="sp-submitting">
          <span className="sp-spinner-wrap">
            <span className="spinner sp-spinner" aria-hidden />
          </span>
          <p className="sp-submitting-title">Saving your idea&hellip;</p>
        </div>
      </div>
    );
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

/* ------------------------------ Success view ------------------------------ */

function SuccessView({ idea, onReset }: { idea: ProductIdea; onReset: () => void }) {
  return (
    <div className="sp-shell">
      <div className="sp-success panel">
        <span className="sp-success-icon">
          <Icons.check size={22} />
        </span>
        <h1 className="sp-success-title">Added to the product board</h1>
        <p className="sp-success-name">{idea.title}</p>
        {idea.category ? <span className="cat-chip sp-cat">{idea.category}</span> : null}
        <p className="sp-success-sub">AI agents are researching this in the background. Check the board in a minute to see market analysis.</p>
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
  onSubmit: (payload: Record<string, unknown>) => void;
  error: string | null;
  onClearError: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const extraFileRef = useRef<HTMLInputElement>(null);
  const imageUrlRef = useRef("");
  const uploadPromiseRef = useRef<Promise<string> | null>(null);
  // Additional shots (labels, tags, angles): URLs + their in-flight uploads,
  // index-aligned so we can await all before submitting.
  const extraImageUrlsRef = useRef<string[]>([]);
  const extraUploadPromisesRef = useRef<Promise<string>[]>([]);
  const [imagePreview, setImagePreview] = useState("");
  const [extras, setExtras] = useState<{ dataUrl: string }[]>([]);
  const [autofill, setAutofill] = useState<AutofillState>("idle");
  const [fields, setFields] = useState<IdeaFields>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [urlAutofill, setUrlAutofill] = useState<AutofillState>("idle");

  function setField(key: keyof IdeaFields, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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

  async function analyseImage(primary: string, extraDataUrls: string[] = []) {
    setAutofill("loading");
    setFormError(null);
    try {
      const res = await fetch("/api/ideas/analyse-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: primary, extraImages: extraDataUrls }),
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
        // Target price is never AI-guessed — keep whatever the submitter typed.
        priceTarget: prev.priceTarget,
        targetMarket: f.targetMarket || prev.targetMarket,
        audience: f.audience || prev.audience,
        submittedBy: prev.submittedBy,
      }));
      setAutofill("done");
    } catch {
      setAutofill("error");
    }
  }

  async function scrapeUrl(url: string) {
    if (!isHttpUrl(url)) return;
    setUrlAutofill("loading");
    setFormError(null);
    try {
      const res = await fetch("/api/ideas/scrape-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setUrlAutofill("error");
        setFormError(data.error || "Could not read that page — fill in the fields manually.");
        return;
      }
      const f = data.fields as Partial<IdeaFields & { imageUrl: string }>;
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
      // If the page had an og:image and no photo was uploaded yet, use it.
      if (f.imageUrl && !imageUrlRef.current) {
        imageUrlRef.current = f.imageUrl;
        setImagePreview(f.imageUrl);
      }
      setUrlAutofill("done");
    } catch {
      setUrlAutofill("error");
      setFormError("Could not reach that page — fill in the fields manually.");
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
      imageUrlRef.current = resized; // set immediately so submit isn't blocked
      // Upload to Storage in parallel with analysis; await on submit.
      uploadPromiseRef.current = uploadImage(resized);
      uploadPromiseRef.current.then((url) => {
        if (url?.startsWith("http")) imageUrlRef.current = url;
      });
      analyseImage(resized, extraImageUrlsRef.current.slice());
    };
    reader.readAsDataURL(file);
  }

  async function handleExtraFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const MAX_EXTRAS = 4;
    const toAdd = Array.from(files).slice(0, MAX_EXTRAS - extras.length);
    if (toAdd.length === 0) return;
    const newEntries: { dataUrl: string }[] = [];
    const newUploadPromises: Promise<string>[] = [];
    for (const file of toAdd) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const raw = await readFileAsDataUrl(file);
        const resized = await resizeImage(raw);
        newEntries.push({ dataUrl: resized });
        const p = uploadImage(resized);
        newUploadPromises.push(p);
        p.then((url) => {
          if (url?.startsWith("http")) {
            const idx = extraUploadPromisesRef.current.indexOf(p);
            if (idx >= 0) extraImageUrlsRef.current[idx] = url;
          }
        });
      } catch {
        /* skip bad files */
      }
    }
    if (newEntries.length === 0) return;
    const startIdx = extraUploadPromisesRef.current.length;
    extraUploadPromisesRef.current.push(...newUploadPromises);
    // Seed with data URLs for now (server re-uploads any that aren't yet hosted).
    for (let i = 0; i < newEntries.length; i++) {
      extraImageUrlsRef.current[startIdx + i] = newEntries[i].dataUrl;
    }
    setExtras((prev) => [...prev, ...newEntries]);
    // Re-analyse with the primary + all extras so labels/tags get picked up.
    if (imageUrlRef.current) {
      const allExtras = [...extraImageUrlsRef.current.slice(0, startIdx), ...newEntries.map((e) => e.dataUrl)];
      analyseImage(imageUrlRef.current, allExtras);
    }
  }

  function removeExtra(idx: number) {
    setExtras((prev) => prev.filter((_, i) => i !== idx));
    extraImageUrlsRef.current.splice(idx, 1);
    extraUploadPromisesRef.current.splice(idx, 1);
  }

  function removeImage() {
    setImagePreview("");
    imageUrlRef.current = "";
    uploadPromiseRef.current = null;
    setExtras([]);
    extraImageUrlsRef.current = [];
    extraUploadPromisesRef.current = [];
    setAutofill("idle");
    setFields(EMPTY);
    if (fileRef.current) fileRef.current.value = "";
    if (extraFileRef.current) extraFileRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    onClearError();
    if (!fields.title.trim()) {
      setFormError("Please give your product idea a title.");
      return;
    }
    // Await any in-flight uploads so we send hosted URLs where possible. Data
    // URLs that haven't finished uploading are still sent — createIdea uploads
    // them server-side as a backstop, so an image is never silently dropped.
    if (uploadPromiseRef.current) {
      try {
        const url = await uploadPromiseRef.current;
        if (url?.startsWith("http")) imageUrlRef.current = url;
      } catch {
        /* keep the data URL fallback */
      }
    }
    if (extraUploadPromisesRef.current.length) {
      const resolved = await Promise.allSettled(extraUploadPromisesRef.current);
      resolved.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value?.startsWith("http")) {
          extraImageUrlsRef.current[i] = r.value;
        }
      });
    }
    const payload: Record<string, unknown> = { ...fields };
    if (imageUrlRef.current) payload.imageUrl = imageUrlRef.current;
    if (extraImageUrlsRef.current.length) payload.imageUrls = [...extraImageUrlsRef.current];
    if (sourceUrl && isHttpUrl(sourceUrl)) payload.sourceUrl = sourceUrl;
    onSubmit(payload);
  }

  const isAnalysing = autofill === "loading";
  const af = autofill === "done";

  return (
    <div className="sp-shell">
      <header className="sp-header">
        <span className="sp-logo">productScope</span>
        <p className="sp-header-sub">Submit a product idea</p>
      </header>

      <form className="sp-form panel" onSubmit={handleSubmit} noValidate>
        {/* ── URL scrape input ── */}
        <div className="idea-url-row">
          <label className="idea-url-label" htmlFor="sp-source-url">
            <Icons.link size={13} />
            Paste a product link
          </label>
          <div className="idea-url-field">
            <input
              id="sp-source-url"
              type="url"
              value={sourceUrl}
              onChange={(e) => { setSourceUrl(e.target.value); setUrlAutofill("idle"); }}
              onBlur={(e) => { if (isHttpUrl(e.target.value)) scrapeUrl(e.target.value); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (isHttpUrl(sourceUrl)) scrapeUrl(sourceUrl); } }}
              placeholder="https://www.amazon.com/dp/… or any product page"
              className="nxb-input idea-url-input"
              disabled={urlAutofill === "loading"}
            />
            {urlAutofill === "loading" && (
              <span className="idea-url-status">
                <span className="spinner" aria-hidden /> Reading page…
              </span>
            )}
            {urlAutofill === "done" && (
              <span className="idea-url-status done">
                <Icons.check size={12} /> Fields filled
              </span>
            )}
            {urlAutofill === "error" && (
              <span className="idea-url-status warn">
                <Icons.alert size={12} /> Could not read page
              </span>
            )}
          </div>
          <p className="idea-url-hint">AI fills the form from the product page. Or upload a photo below.</p>
        </div>

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

        {/* Additional shots — labels, tags, different angles (up to 4) */}
        {imagePreview && (
          <div className="idea-extras">
            <p className="idea-extras-label">
              <Icons.image size={12} /> Additional shots
              <span className="idea-extras-hint"> — labels, tags, different angles (up to 4)</span>
            </p>
            <div className="idea-extras-row">
              {extras.map((ex, i) => (
                <div key={i} className="idea-extra-thumb-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ex.dataUrl} alt={`Extra ${i + 1}`} className="idea-extra-thumb" />
                  <button
                    type="button"
                    className="idea-extra-remove"
                    onClick={() => removeExtra(i)}
                    aria-label="Remove"
                  >
                    <Icons.x size={10} />
                  </button>
                </div>
              ))}
              {extras.length < 4 && (
                <button
                  type="button"
                  className="idea-extra-add"
                  onClick={() => extraFileRef.current?.click()}
                >
                  <Icons.plus size={16} />
                </button>
              )}
            </div>
            <input
              ref={extraFileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden-input"
              onChange={(e) => handleExtraFiles(e.target.files)}
            />
          </div>
        )}

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

        <SimilarIdeas
          title={fields.title}
          category={fields.category}
          features={fields.features}
          description={fields.description}
        />

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
