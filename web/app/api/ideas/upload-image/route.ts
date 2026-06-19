import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminEnabled } from "@/lib/ideas/supabase-admin";
import { randomUUID } from "node:crypto";

/**
 * POST /api/ideas/upload-image
 * Accepts { imageData: "data:image/jpeg;base64,..." }
 * Uploads to Supabase Storage bucket "product-images" and returns { url }.
 * Falls back to returning the original data URL when Storage is not configured.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

const BUCKET = "product-images";

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

  if (!supabaseAdminEnabled()) {
    // Without Storage, return the data URL unchanged — renderings will skip it
    // but at least the analyse-image flow still works.
    return NextResponse.json({ url: imageData });
  }

  // Parse data URL: "data:<mime>;base64,<data>"
  const [header, b64] = imageData.split(",", 2);
  const mime = header.match(/data:(image\/[^;]+)/)?.[1] ?? "image/jpeg";
  const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const buffer = Buffer.from(b64, "base64");

  const path = `uploads/${randomUUID()}.${ext}`;
  const client = supabaseAdmin()!;

  // Ensure bucket exists (no-op if it does).
  await client.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 10_485_760 }).catch(() => {});

  const { error } = await client.storage.from(BUCKET).upload(path, buffer, {
    contentType: mime,
    upsert: false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: pub } = client.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: pub.publicUrl });
}
