import "server-only";
import type { ProductIdea, Rendering } from "./types";

export function falEnabled(): boolean {
  return Boolean(process.env.FAL_KEY);
}

const SCENES: Array<{ id: Rendering["scene"]; prompt: string }> = [
  { id: "shelf", prompt: "product displayed on a clean retail shelf, soft studio lighting, professional e-commerce photography" },
  { id: "lifestyle", prompt: "product in a natural lifestyle setting, warm natural light, aspirational photography" },
  { id: "hero", prompt: "hero product shot, pure white background, dramatic studio lighting, commercial photography" },
];

/** Result of generating one scene: either a rendering or a human-readable reason. */
type OneResult = { rendering: Rendering } | { error: string };

async function generateOne(imageUrl: string, scene: typeof SCENES[0]): Promise<OneResult> {
  const key = process.env.FAL_KEY;
  if (!key) return { error: "FAL_KEY not set" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetch("https://fal.run/fal-ai/bria/product-shot", {
      method: "POST",
      headers: { "Authorization": `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        scene_description: scene.prompt,
        placement_type: "automatic",
        num_results: 1,
        fast: true,
      }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      // Surface the actual reason — fal returns JSON like { detail: "..." }.
      const body = await res.text().catch(() => "");
      const reason = `fal.ai ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`;
      console.error(`[renderings] ${scene.id} failed — ${reason}`);
      return { error: reason };
    }
    const data = await res.json() as { images?: { url: string; width: number; height: number }[] };
    const img = data.images?.[0];
    if (!img?.url) {
      console.error(`[renderings] ${scene.id} — no image in fal response`);
      return { error: "fal.ai returned no image" };
    }
    return { rendering: { url: img.url, scene: scene.id, width: img.width ?? 1024, height: img.height ?? 1024 } };
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
  /** A representative failure reason when nothing was generated (for the UI). */
  error?: string;
};

export async function generateRenderings(idea: ProductIdea): Promise<RenderingResult> {
  if (!falEnabled()) return { renderings: [], error: "FAL_KEY not set" };
  const imageUrl = idea.imageUrl;
  // bria/product-shot needs a public http(s) image — base64 data URLs won't work.
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
