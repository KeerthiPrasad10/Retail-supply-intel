import { NextResponse } from "next/server";

/**
 * Vision endpoint for the Validate view's image-driven form.
 *
 * POST /api/ideas/analyse-image  { imageData: string }   (base64 data-URL or https URL)
 * → { title, description, category, features, priceTarget, targetMarket, audience }
 *
 * With no API key returns 501; the form falls back to manual entry.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODEL = "claude-sonnet-4-6";
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

function apiKey() {
  return process.env.ANTHROPIC_API_KEY || process.env.RSI_ANTHROPIC_API_KEY;
}

const PROMPT = `Look at this product image and extract as much information as you can for a product sourcing form.

Return ONLY a JSON object (no prose, no code fence) with these exact keys — leave a key as an empty string "" if you truly cannot determine it:
{
  "title": "short product name (3-8 words)",
  "description": "2-3 sentence description: what it is, who it's for, what makes it useful",
  "category": "best matching category from: ${CATEGORIES.join(", ")}",
  "features": "key product features, one per line",
  "priceTarget": "estimated retail price range in USD e.g. $15–30 (leave blank if unclear)",
  "targetMarket": "likely target market(s) e.g. US, UK, Australia",
  "audience": "primary target audience e.g. Parents of young children"
}`;

type ImageSource =
  | { type: "base64"; media_type: string; data: string }
  | { type: "url"; url: string };

function imageBlock(imageData: string): { type: "image"; source: ImageSource } | null {
  if (imageData.startsWith("data:")) {
    const m = imageData.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
    if (!m) return null;
    return { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } };
  }
  if (imageData.startsWith("https://") || imageData.startsWith("http://")) {
    return { type: "image", source: { type: "url", url: imageData } };
  }
  return null;
}

type AnalysisResult = {
  title?: string;
  description?: string;
  category?: string;
  features?: string;
  priceTarget?: string;
  targetMarket?: string;
  audience?: string;
};

function parseJson(text: string): AnalysisResult | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const key = apiKey();
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "AI not configured (set ANTHROPIC_API_KEY)." },
      { status: 501 },
    );
  }

  let body: { imageData?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body?.imageData) {
    return NextResponse.json({ ok: false, error: "Missing imageData." }, { status: 400 });
  }

  const block = imageBlock(body.imageData);
  if (!block) {
    return NextResponse.json({ ok: false, error: "Unsupported image format." }, { status: 415 });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: [block, { type: "text", text: PROMPT }],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json(
      { ok: false, error: `Claude error (${res.status}): ${detail.slice(0, 200)}` },
      { status: 502 },
    );
  }

  const data = await res.json();
  const text: string = (data.content ?? [])
    .filter((b: { type?: string }) => b.type === "text")
    .map((b: { text?: string }) => b.text ?? "")
    .join("");

  const parsed = parseJson(text);
  if (!parsed) {
    return NextResponse.json({ ok: false, error: "Could not parse Claude response." }, { status: 502 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return NextResponse.json({
    ok: true,
    fields: {
      title: str(parsed.title),
      description: str(parsed.description),
      category: str(parsed.category),
      features: str(parsed.features),
      priceTarget: str(parsed.priceTarget),
      targetMarket: str(parsed.targetMarket),
      audience: str(parsed.audience),
    },
  });
}
