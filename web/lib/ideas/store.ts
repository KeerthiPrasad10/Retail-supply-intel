import "server-only";

import { randomUUID } from "node:crypto";
import type { NewIdeaInput, ProductIdea } from "./types";
import { supabaseAdmin, supabaseAdminEnabled } from "./supabase-admin";
import { uploadDataUrlToStorage } from "./storage";

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
    imageUrls: input.imageUrls ?? [],
    sourceUrl: (input.sourceUrl || "").trim() || undefined,
    submittedBy: (input.submittedBy || "").trim(),
    status: "queued",
  };
}

/* ---------- Supabase row mapping ---------- */

function rowToIdea(row: Record<string, unknown>): ProductIdea {
  const rawUrls = row.image_urls;
  const imageUrls: string[] = Array.isArray(rawUrls)
    ? rawUrls.filter((u): u is string => typeof u === "string" && u.startsWith("http"))
    : [];
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
    imageUrls,
    sourceUrl: row.source_url ? String(row.source_url) : undefined,
    submittedBy: String(row.submitted_by ?? ""),
    status: (row.status as ProductIdea["status"]) ?? "queued",
    research: (row.research as ProductIdea["research"]) ?? undefined,
  };
}

function ideaToRow(idea: ProductIdea): Record<string, unknown> {
  // Don't persist base64 data URLs — the image_url column is VARCHAR(2048).
  const imageUrl = idea.imageUrl?.startsWith("data:") ? null : (idea.imageUrl || null);
  // Additional images: only persist http URLs (data URLs stripped here too).
  const imageUrls = (idea.imageUrls ?? []).filter((u) => u.startsWith("http"));
  return {
    id: idea.id,
    title: idea.title,
    description: idea.description,
    image_url: imageUrl,
    image_urls: imageUrls,
    target_market: idea.targetMarket || null,
    price_target: idea.priceTarget || null,
    category: idea.category || null,
    audience: idea.audience || null,
    features: idea.features || null,
    submitted_by: idea.submittedBy || null,
    source_url: idea.sourceUrl || null,
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

  // Upload any data URLs to Storage server-side — guarantees persistence
  // regardless of whether the client's parallel upload won the race.
  if (supabaseAdminEnabled()) {
    if (idea.imageUrl?.startsWith("data:")) {
      const hosted = await uploadDataUrlToStorage(idea.imageUrl);
      if (hosted) idea.imageUrl = hosted;
    }
    if (idea.imageUrls?.length) {
      idea.imageUrls = await Promise.all(
        idea.imageUrls.map(async (u) => {
          if (!u.startsWith("data:")) return u;
          const hosted = await uploadDataUrlToStorage(u);
          return hosted ?? u;
        })
      );
    }
  }

  if (supabaseAdminEnabled()) {
    const { data, error } = await supabaseAdmin()!
      .from(TABLE)
      .insert(ideaToRow(idea))
      .select("*")
      .single();
    if (error) throw error;
    const merged = { ...idea, ...rowToIdea(data as Record<string, unknown>), id: idea.id };
    merged.category = idea.category;
    merged.audience = idea.audience;
    merged.features = idea.features;
    merged.submittedBy = idea.submittedBy;
    // Preserve in-session images that were stripped (data URLs / not-yet-uploaded).
    if (!merged.imageUrl && idea.imageUrl) merged.imageUrl = idea.imageUrl;
    if (!merged.imageUrls?.length && idea.imageUrls?.length) merged.imageUrls = idea.imageUrls;
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
    if (patch.imageUrls !== undefined) row.image_urls = patch.imageUrls.filter((u) => u.startsWith("http"));
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

/* ---------- Similar-idea discovery ---------- */

/** Lightweight shape returned to the submit form — no research payload. */
export type SimilarIdea = {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  submittedBy: string;
  status: ProductIdea["status"];
  createdAt: string;
  hasResearch: boolean;
};

export type SimilarInput = {
  title?: string;
  category?: string;
  features?: string;
  description?: string;
};

function simTokens(...parts: (string | undefined)[]): Set<string> {
  const out = new Set<string>();
  for (const p of parts) {
    if (!p) continue;
    for (const w of p.toLowerCase().split(/[^a-z0-9]+/)) if (w.length >= 3) out.add(w);
  }
  return out;
}

/** Best available category label for an idea (research-derived first). */
function candidateCategory(i: ProductIdea): string {
  return (
    i.research?.classification?.category ||
    i.research?.enrichment?.suggestedCategory ||
    i.category ||
    ""
  );
}

/** Overlap score between a draft and an existing idea. Word overlap on
 *  title/features/description plus a strong boost when categories align. */
function similarityScore(draft: SimilarInput, cand: ProductIdea): number {
  const dt = simTokens(draft.title, draft.features, draft.description);
  const ct = simTokens(cand.title, cand.features, cand.description, candidateCategory(cand));
  let score = 0;
  for (const t of dt) if (ct.has(t)) score += 1;
  const dc = (draft.category || "").toLowerCase().trim();
  const cc = candidateCategory(cand).toLowerCase().trim();
  if (dc && cc && (dc === cc || cc.includes(dc) || dc.includes(cc))) score += 3;
  return score;
}

/**
 * Find existing ideas similar to a draft so the submitter can see what the team
 * has already proposed. Ranks by overlap; ties broken by most-recent.
 */
export async function findSimilarIdeas(draft: SimilarInput, limit = 4): Promise<SimilarIdea[]> {
  const all = await listIdeas();
  return all
    .map((i) => ({ i, score: similarityScore(draft, i) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.i.createdAt.localeCompare(a.i.createdAt))
    .slice(0, limit)
    .map(({ i }) => ({
      id: i.id,
      title: i.title,
      category: candidateCategory(i),
      imageUrl: i.imageUrl,
      submittedBy: i.submittedBy,
      status: i.status,
      createdAt: i.createdAt,
      hasResearch: Boolean(i.research),
    }));
}
