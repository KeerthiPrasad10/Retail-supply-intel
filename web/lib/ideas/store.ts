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
