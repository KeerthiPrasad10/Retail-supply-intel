import { NextResponse } from "next/server";
import { uploadDataUrlToStorage } from "@/lib/ideas/storage";

/**
 * POST /api/ideas/upload-image
 * Accepts { imageData: "data:image/jpeg;base64,..." }
 * Uploads to Supabase Storage bucket "product-images" and returns { url }.
 * Falls back to returning the original data URL when Storage is not configured.
 *
 * This is an optimisation for the form (so the preview/analyse step has the
 * public URL early); idea creation uploads server-side too, so persistence no
 * longer depends on this call succeeding.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const imageData = typeof body.imageData === "string" ? body.imageData : null;
  if (!imageData?.startsWith("data:image/")) {
    return NextResponse.json({ error: "imageData must be a data URL" }, { status: 400 });
  }

  // Without Storage configured, return the data URL unchanged — renderings will
  // skip it but the analyse-image flow still works.
  const hosted = await uploadDataUrlToStorage(imageData);
  return NextResponse.json({ url: hosted ?? imageData });
}
