import { NextResponse } from "next/server";

/**
 * Real document-extraction endpoint for the Supplier Onboarding portal.
 *
 * A supplier uploads a licence / bank proof / certificate; this route sends the
 * document to Claude (vision + document understanding), which OCRs, translates
 * to English, and returns the fields for that document type with a per-field
 * confidence. The portal prefills blank fields only; a human still confirms,
 * and LKA independently verifies before anything is treated as written-back
 * (see NxB_Supplier_Autofill_Wiring_Spec.md §1, §5, §6).
 *
 * Key resolution (server env only — never shipped to the browser):
 *   ANTHROPIC_API_KEY        preferred (set this in Vercel → Env Vars)
 *   RSI_ANTHROPIC_API_KEY    fallback (same key the pipeline already uses)
 * With no key the route returns 501 and the portal falls back to its mock
 * extraction, so the demo always works.
 *
 *   GET  /api/extract  → { configured } so the UI can show a live/off badge.
 *   POST /api/extract  → { ok, docType, fields: ExtractedField[] }
 *     body: { filename, mediaType, dataBase64, docType? }
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = process.env.EXTRACT_MODEL || "claude-sonnet-4-6";

function apiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || process.env.RSI_ANTHROPIC_API_KEY;
}

// Document → fields it can fill, grounded in the prototype SCHEMA / spec §4.
// `fill: 'doc'` fields only — supplier- and LKA-entered fields are never extracted.
const DOC_FIELDS: Record<string, { key: string; label: string }[]> = {
  license: [
    { key: "name", label: "Supplier / company name" },
    { key: "licNo", label: "Business licence number" },
    { key: "licCountry", label: "Licence country" },
    { key: "licIssue", label: "Licence issue date (YYYY-MM-DD)" },
    { key: "licExp", label: "Licence expiry date (YYYY-MM-DD)" },
    { key: "addr", label: "Registered address" },
    { key: "city", label: "City" },
    { key: "province", label: "Province / region" },
  ],
  bank: [
    { key: "bankName", label: "Bank name" },
    { key: "acctHolder", label: "Account holder" },
    { key: "bankAcct", label: "Account number / IBAN" },
    { key: "swift", label: "SWIFT / BIC" },
    { key: "currency", label: "Currency (ISO 4217)" },
  ],
  social: [
    { key: "amforiId", label: "amfori ID / DBID" },
    { key: "amforiSite", label: "amfori site ID" },
    { key: "monId", label: "Monitoring ID" },
    { key: "bsciRating", label: "amfori BSCI rating (A–E)" },
    { key: "bsciExp", label: "BSCI valid until (YYYY-MM-DD)" },
  ],
  env: [
    { key: "isoNo", label: "ISO 14001 certificate number" },
    { key: "isoExp", label: "ISO 14001 expiry (YYYY-MM-DD)" },
  ],
  fire: [
    { key: "fireNo", label: "Fire / building safety certificate number" },
    { key: "fireExp", label: "Fire safety expiry (YYYY-MM-DD)" },
  ],
  factory: [
    { key: "facName", label: "Factory name" },
    { key: "facAddr", label: "Factory address" },
    { key: "monthlyCapacity", label: "Monthly capacity (units)" },
    { key: "facPort", label: "Port of loading" },
  ],
  trial: [
    { key: "trialIan", label: "Trial quotation IAN" },
    { key: "trialFob", label: "Trial FOB price (USD)" },
  ],
};

// Union of every doc field, used when the type is unknown (open reasoning).
const ALL_FIELDS = Array.from(
  new Map(Object.values(DOC_FIELDS).flat().map((f) => [f.key, f])).values(),
);

const KNOWN_TYPES = Object.keys(DOC_FIELDS).join(", ");

type ExtractedField = {
  fieldKey: string;
  label: string;
  value: string;
  confidence: number;
  lang?: string;
  translated?: boolean;
  reasoned?: boolean;
};

export function GET() {
  return NextResponse.json({ configured: Boolean(apiKey()), model: MODEL });
}

function buildPrompt(docType: string | undefined): string {
  const known = docType && DOC_FIELDS[docType];
  const fields = known ? DOC_FIELDS[docType] : ALL_FIELDS;
  const list = fields.map((f) => `- ${f.key}: ${f.label}`).join("\n");
  const intro = known
    ? `This is a supplier "${docType}" document for retail onboarding (Lidl Kaufland Asia). Extract only the fields below that the document actually contains.`
    : `Classify this supplier document (one of: ${KNOWN_TYPES}) then extract whichever of the fields below it contains. This is open reasoning — be conservative with confidence.`;
  return [
    intro,
    "",
    "Fields:",
    list,
    "",
    "Rules:",
    "- OCR the document, then translate values to English. Keep the original-language string in `original` and set `lang` (ISO-639-1) and `translated` accordingly.",
    "- Dates as YYYY-MM-DD. Currencies as ISO 4217. Omit any field the document does not contain — do not guess.",
    "- `confidence` is 0..1: how sure you are the value is correct AND read from this document. Lower it for blurry scans, partial matches, or inferred values.",
    "",
    'Respond with ONLY a JSON object, no prose: {"docType": "<one of the known types or \\"unknown\\">", "fields": [{"fieldKey": "...", "value": "...", "confidence": 0.0, "lang": "..", "translated": false, "original": "..."}]}',
  ].join("\n");
}

function contentBlock(mediaType: string, dataBase64: string) {
  if (mediaType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: mediaType, data: dataBase64 } };
  }
  if (mediaType.startsWith("image/")) {
    return { type: "image", source: { type: "base64", media_type: mediaType, data: dataBase64 } };
  }
  return null;
}

function parseJson(text: string): { docType?: string; fields?: unknown[] } | null {
  // Models sometimes wrap JSON in prose or code fences — extract the object.
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
      { ok: false, configured: false, error: "AI parsing not configured (set ANTHROPIC_API_KEY)." },
      { status: 501 },
    );
  }

  let body: { filename?: string; mediaType?: string; dataBase64?: string; docType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const { mediaType, dataBase64, docType } = body;
  if (!mediaType || !dataBase64) {
    return NextResponse.json({ ok: false, error: "Missing mediaType or dataBase64." }, { status: 400 });
  }

  const block = contentBlock(mediaType, dataBase64);
  if (!block) {
    return NextResponse.json(
      { ok: false, error: `Unsupported type ${mediaType}. Upload a PDF or image.` },
      { status: 415 },
    );
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system:
          "You are NxB Parse, an extraction engine for supplier onboarding documents. " +
          "You read scanned/photographed certificates and licences in any language, translate to English, " +
          "and return strictly-typed JSON. Ground every value in the document; never invent.",
        messages: [{ role: "user", content: [block, { type: "text", text: buildPrompt(docType) }] }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json(
        { ok: false, error: `Extraction failed (${res.status}): ${detail.slice(0, 200)}` },
        { status: 502 },
      );
    }

    const data = await res.json();
    const text: string = (data.content || [])
      .filter((b: { type?: string }) => b.type === "text")
      .map((b: { text?: string }) => b.text || "")
      .join("");

    const parsed = parseJson(text);
    if (!parsed || !Array.isArray(parsed.fields)) {
      return NextResponse.json({ ok: true, docType: docType || "unknown", fields: [] });
    }

    const labelFor = (k: string) =>
      ALL_FIELDS.find((f) => f.key === k)?.label || k;
    const fields: ExtractedField[] = parsed.fields
      .map((f) => f as Record<string, unknown>)
      .filter((f) => typeof f.fieldKey === "string" && f.value != null && String(f.value) !== "")
      .map((f) => ({
        fieldKey: String(f.fieldKey),
        label: labelFor(String(f.fieldKey)),
        value: String(f.value),
        confidence:
          typeof f.confidence === "number" ? Math.max(0, Math.min(1, f.confidence)) : 0.8,
        lang: typeof f.lang === "string" ? f.lang : undefined,
        translated: Boolean(f.translated),
        reasoned: !docType || !DOC_FIELDS[docType],
      }));

    return NextResponse.json({ ok: true, docType: parsed.docType || docType || "unknown", fields });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "extraction error" },
      { status: 502 },
    );
  }
}
