import "server-only";

import { randomUUID } from "node:crypto";
import { supabaseAdmin, supabaseAdminEnabled } from "./supabase-admin";

/**
 * Image persistence to Supabase Storage.
 *
 * A product photo arrives from the browser as a base64 data URL. The
 * `image_url` column is VARCHAR(2048), far too small for an inline image, and
 * fal.ai renderings need a *public http* URL — so the data URL must be uploaded
 * to the public `product-images` bucket and replaced with its public URL.
 *
 * This runs server-side during idea creation so persistence never depends on a
 * client-side race (the browser firing an upload and hoping it resolves before
 * submit). With Storage unconfigured it returns null and callers keep the data
 * URL in the in-process cache for the current session only.
 */

const BUCKET = "product-images";

let bucketEnsured = false;

/** Upload a base64 data URL to Storage; returns the public http URL or null. */
export async function uploadDataUrlToStorage(dataUrl: string): Promise<string | null> {
  if (!dataUrl.startsWith("data:image/") || !supabaseAdminEnabled()) return null;

  const [header, b64] = dataUrl.split(",", 2);
  if (!b64) return null;
  const mime = header.match(/data:(image\/[^;]+)/)?.[1] ?? "image/jpeg";
  const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const buffer = Buffer.from(b64, "base64");

  const client = supabaseAdmin()!;
  if (!bucketEnsured) {
    await client.storage
      .createBucket(BUCKET, { public: true, fileSizeLimit: 10_485_760 })
      .catch(() => {});
    bucketEnsured = true;
  }

  const path = `uploads/${randomUUID()}.${ext}`;
  const { error } = await client.storage.from(BUCKET).upload(path, buffer, {
    contentType: mime,
    upsert: false,
  });
  if (error) {
    console.error(`[storage] upload failed — ${error.message}`);
    return null;
  }

  const { data: pub } = client.storage.from(BUCKET).getPublicUrl(path);
  return pub.publicUrl || null;
}
