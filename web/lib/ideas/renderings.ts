import "server-only";
import type { ProductIdea, Rendering } from "./types";

export function falEnabled(): boolean {
  return Boolean(process.env.FAL_KEY);
}

// FLUX Kontext Pro — takes the product image + a scene prompt and composites
// the product into the scene. Much sharper than bria/product-shot.
const ENDPOINT = "https://fal.run/fal-ai/flux-pro/kontext";

const SCENES: Array<{ id: Rendering["scene"]; prompt: string }> = [
  {
    id: "shelf",
    prompt:
      "Place this product on a clean retail shelf with soft studio lighting. Professional e-commerce photography, sharp focus on the product, neutral background.",
  },
  {
    id: "lifestyle",
    prompt:
      "Place this product in a natural lifestyle setting with warm natural light. Aspirational photography, product prominently featured, realistic environment.",
  },
  {
    id: "hero",
    prompt:
      "Hero product shot on a pure white background with dramatic studio lighting. Commercial photography, ultra-sharp, shadows underneath, product centred.",
  },
];

type OneResult = { rendering: Rendering } | { error: string };

async function generateOne(imageUrl: string, scene: (typeof SCENES)[0]): Promise<OneResult> {
  const key = process.env.FAL_KEY;
  if (!key) return { error: "FAL_KEY not set" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        prompt: scene.prompt,
        num_images: 1,
        guidance_scale: 3.5,
        output_format: "jpeg",
      }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const reason = `fal.ai ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`;
      console.error(`[renderings] ${scene.id} failed — ${reason}`);
      return { error: reason };
    }
    const data = (await res.json()) as { images?: { url: string; width: number; height: number }[] };
    const img = data.images?.[0];
    if (!img?.url) {
      console.error(`[renderings] ${scene.id} — no image in fal response`);
      return { error: "fal.ai returned no image" };
    }
    return {
      rendering: {
        url: img.url,
        scene: scene.id,
        width: img.width ?? 1024,
        height: img.height ?? 1024,
      },
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "request failed";
    console.error(`[renderings] ${scene.id} threw — ${reason}`);
    return { error: reason };
  } finally {
    clearTimeout(timer);
  }
}

export type RenderingResult = {
  renderings: Rendering[];
  error?: string;
};

export async function generateRenderings(idea: ProductIdea): Promise<RenderingResult> {
  if (!falEnabled()) return { renderings: [], error: "FAL_KEY not set" };
  const imageUrl = idea.imageUrl;
  if (!imageUrl || !imageUrl.startsWith("http")) {
    return { renderings: [], error: "no public image URL" };
  }

  const results = await Promise.all(SCENES.map((s) => generateOne(imageUrl, s)));
  const renderings = results
    .filter((r): r is { rendering: Rendering } => "rendering" in r)
    .map((r) => r.rendering);
  const firstError = results.find((r): r is { error: string } => "error" in r);
  return { renderings, error: renderings.length ? undefined : firstError?.error };
}
