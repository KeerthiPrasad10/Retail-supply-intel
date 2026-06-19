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

async function generateOne(imageUrl: string, scene: typeof SCENES[0]): Promise<Rendering | null> {
  const key = process.env.FAL_KEY;
  if (!key) return null;
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
    if (!res.ok) return null;
    const data = await res.json() as { images?: { url: string; width: number; height: number }[] };
    const img = data.images?.[0];
    if (!img?.url) return null;
    return { url: img.url, scene: scene.id, width: img.width ?? 1024, height: img.height ?? 1024 };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function generateRenderings(idea: ProductIdea): Promise<Rendering[]> {
  if (!falEnabled()) return [];
  // Only generate renderings when a real image URL is available (not base64)
  const imageUrl = idea.imageUrl;
  if (!imageUrl || imageUrl.startsWith("data:") || !imageUrl.startsWith("http")) return [];

  const results = await Promise.allSettled(SCENES.map(s => generateOne(imageUrl, s)));
  return results
    .filter((r): r is PromiseFulfilledResult<Rendering> => r.status === "fulfilled" && r.value !== null)
    .map(r => r.value);
}
