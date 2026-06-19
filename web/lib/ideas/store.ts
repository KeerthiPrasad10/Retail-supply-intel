import "server-only";

import { randomUUID } from "node:crypto";
import type { NewIdeaInput, ProductIdea } from "./types";
import { supabaseAdmin, supabaseAdminEnabled } from "./supabase-admin";
import { uploadDataUrlToStorage } from "./storage";

/**
 * Persistence for product ideas.
 *
 * - With Supabase configured (service-role key), ideas live in the
 *   `product_ideas` table (see supabase/migrations/0006_product_ideas.sql and
 *   pipelines/src/rsi/models.py::ProductIdea).
 * - Without it, an in-memory map keeps the feature working for build/runtime.
 *   This is module-scoped, not a file on disk — serverless cold starts reset it,
 *   which is fine: the demo flow creates and researches within one process, and
 *   results are echoed back to the client.
 *
 * The canonical `product_ideas` columns are a subset of ProductIdea (title,
 * description, category_id, image_url, target_market, target_price, status,
 * research, created_at). The auxiliary free-text inputs (audience, features,
 * submittedBy, the typed category label) are carried in the in-memory store and
 * in the request flow; on the Supabase read path they are reconstructed from the
 * columns available, which is sufficient for the research pipeline.
 */

const TABLE = "product_ideas";

const mem = new Map<string, ProductIdea>();

function newIdea(input: NewIdeaInput): ProductIdea {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    title: input.title.trim(),
    description: (input.description || "").trim(),
    category: (input.category || "").trim(),
    targetMarket: (input.targetMarket || "").trim(),
    audience: (input.audience || "").trim(),
    priceTarget: (input.priceTarget || "").trim(),
    features: (input.features || "").trim(),
    imageUrl: (input.imageUrl || "").trim(),
    submittedBy: (input.submittedBy || "").trim(),
    status: "queued",
  };
}

/* ---------- Supabase row mapping ---------- */

function rowToIdea(row: Record<string, unknown>): ProductIdea {
  return {
    id: String(row.id),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    category: String(row.category ?? ""),
    targetMarket: String(row.target_market ?? ""),
    audience: String(row.audience ?? ""),
    priceTarget: String(row.price_target ?? row.target_price ?? ""),
    features: String(row.features ?? ""),
    imageUrl: String(row.image_url ?? ""),
    submittedBy: String(row.submitted_by ?? ""),
    status: (row.status as ProductIdea["status"]) ?? "queued",
    research: (row.research as ProductIdea["research"]) ?? undefined,
  };
}

function ideaToRow(idea: ProductIdea): Record<string, unknown> {
  // Don't persist base64 data URLs — the image_url column is VARCHAR(2048)
  // and base64-encoded images are hundreds of KB. The data URL is only needed
  // for the analyse-image step which runs before this point.
  const imageUrl = idea.imageUrl?.startsWith("data:") ? null : (idea.imageUrl || null);
  return {
    id: idea.id,
    title: idea.title,
    description: idea.description,
    image_url: imageUrl,
    target_market: idea.targetMarket || null,
    price_target: idea.priceTarget || null,
    category: idea.category || null,
    audience: idea.audience || null,
    features: idea.features || null,
    submitted_by: idea.submittedBy || null,
    status: idea.status,
    research: idea.research ?? null,
  };
}

/* ---------- Public API ---------- */

export async function listIdeas(): Promise<ProductIdea[]> {
  if (supabaseAdminEnabled()) {
    const { data, error } = await supabaseAdmin()!
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => rowToIdea(r as Record<string, unknown>));
  }
  return [...mem.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getIdea(id: string): Promise<ProductIdea | undefined> {
  if (supabaseAdminEnabled()) {
    const { data, error } = await supabaseAdmin()!.from(TABLE).select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? rowToIdea(data as Record<string, unknown>) : undefined;
  }
  return mem.get(id);
}

export async function createIdea(input: NewIdeaInput): Promise<ProductIdea> {
  const idea = newIdea(input);

  // If the client sent a base64 data URL, persist it to Storage *here* (server
  // side) and swap in the public http URL. This guarantees the image survives
  // to the DB regardless of whether the client's own upload won its race — the
  // failure mode that left every earlier row's image_url null.
  const original = idea.imageUrl;
  if (original?.startsWith("data:") && supabaseAdminEnabled()) {
    const hosted = await uploadDataUrlToStorage(original);
    if (hosted) idea.imageUrl = hosted;
  }

  if (supabaseAdminEnabled()) {
    const { data, error } = await supabaseAdmin()!
      .from(TABLE)
      .insert(ideaToRow(idea))
      .select("*")
      .single();
    if (error) throw error;
    // Keep the rich input fields available for the immediate research call.
    const merged = { ...idea, ...rowToIdea(data as Record<string, unknown>), id: idea.id };
    merged.category = idea.category;
    merged.audience = idea.audience;
    merged.features = idea.features;
    merged.submittedBy = idea.submittedBy;
    // DB strips data URLs (VARCHAR(2048) too small); preserve the original in
    // the in-process cache so the card shows the image during the current session.
    if (!merged.imageUrl && idea.imageUrl) merged.imageUrl = idea.imageUrl;
    mem.set(merged.id, merged);
    return merged;
  }

  mem.set(idea.id, idea);
  return idea;
}

export async function updateIdea(
  id: string,
  patch: Partial<ProductIdea>
): Promise<ProductIdea | undefined> {
  if (supabaseAdminEnabled()) {
    const row: Record<string, unknown> = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.research !== undefined) row.research = patch.research;
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.imageUrl !== undefined) row.image_url = patch.imageUrl;
    if (patch.targetMarket !== undefined) row.target_market = patch.targetMarket;
    if (patch.priceTarget !== undefined) row.price_target = patch.priceTarget;
    if (patch.category !== undefined) row.category = patch.category;
    const { data, error } = await supabaseAdmin()!
      .from(TABLE)
      .update(row)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    const prev = mem.get(id);
    const merged = { ...(prev ?? {}), ...rowToIdea(data as Record<string, unknown>), ...patch, id };
    mem.set(id, merged as ProductIdea);
    return merged as ProductIdea;
  }

  const prev = mem.get(id);
  if (!prev) return undefined;
  const next = { ...prev, ...patch, id };
  mem.set(id, next);
  return next;
}
