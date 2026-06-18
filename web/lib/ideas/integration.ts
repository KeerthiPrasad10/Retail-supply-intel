import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Maker, ProductIdea, ResearchResult, Supplier } from "./types";
import { supabaseAdmin, supabaseAdminEnabled } from "./supabase-admin";
import { parsePrice } from "./price";

/**
 * Fan an idea's research out into RSI's canonical shared tables. Best-effort: a
 * write-back failure never blocks the research response.
 *
 * Reconciled to RSI's schema (see pipelines/src/rsi/models.py):
 * - resolve-or-create on `product_categories`, then stamp `product_ideas.category_id`.
 * - `suppliers(name, country_code, category_id, external_id, source)`.
 * - `competitors(name, home_country)` — the non-schema `source` column SupplyScope
 *   used is dropped.
 * - The analysis lands as a row in the existing `triggers` table
 *   (score, rationale, payload JSON, status, category_id).
 * - We deliberately do NOT write to `snapshots` (the dashboard reads the latest
 *   snapshot as its whole view-model) or to `insights`.
 */

function aliexpressId(url: string): string | null {
  const m = url.match(/\/item\/(\d+)\.html/);
  return m ? m[1] : null;
}

async function resolveCategoryId(
  sb: SupabaseClient,
  name: string,
  keywords: string[]
): Promise<number | null> {
  if (!name) return null;
  const { data: existing } = await sb.from("product_categories").select("id").ilike("name", name).limit(1);
  if (existing && existing.length) return existing[0].id as number;
  const { data: inserted, error } = await sb
    .from("product_categories")
    .insert({ name: name.slice(0, 128), keywords: keywords ?? [] })
    .select("id")
    .single();
  if (!error && inserted) return inserted.id as number;
  const { data: again } = await sb.from("product_categories").select("id").ilike("name", name).limit(1);
  return again && again.length ? (again[0].id as number) : null;
}

async function validCountryCodes(sb: SupabaseClient): Promise<Set<string>> {
  const { data } = await sb.from("countries").select("code");
  return new Set((data ?? []).map((r: { code: string }) => r.code));
}

async function writeSuppliers(
  sb: SupabaseClient,
  categoryId: number | null,
  suppliers: Supplier[],
  codes: Set<string>
): Promise<void> {
  if (!suppliers.length) return;
  const names = suppliers.map((s) => s.name);
  const { data: existing } = await sb.from("suppliers").select("name").in("name", names);
  const have = new Set((existing ?? []).map((r: { name: string }) => r.name));
  const rows = suppliers
    .filter((s) => !have.has(s.name))
    .map((s) => ({
      name: s.name.slice(0, 256),
      country_code: s.source === "aliexpress" && codes.has("CN") ? "CN" : null,
      category_id: categoryId,
      external_id: s.source === "aliexpress" ? aliexpressId(s.url) : null,
      source: s.source || "web",
    }));
  if (rows.length) await sb.from("suppliers").insert(rows);
}

async function writeCompetitors(sb: SupabaseClient, makers: Maker[]): Promise<void> {
  // RSI's competitors table is (name, home_country) — no `source` column.
  const rows = makers
    .map((m) => m.name)
    .filter(Boolean)
    .map((n) => ({ name: n.slice(0, 128) }));
  if (rows.length) await sb.from("competitors").upsert(rows, { onConflict: "name", ignoreDuplicates: true });
}

function buildRationale(idea: ProductIdea, research: ResearchResult): string {
  const a = research.analysis;
  const parts: string[] = [];
  if (a?.positioning) parts.push(a.positioning);
  if (a?.suggestedPrice) parts.push(`Suggested price: ${a.suggestedPrice}.`);
  if (a?.differentiation?.length) parts.push(`Differentiation: ${a.differentiation.join("; ")}.`);
  if (a?.nextSteps?.length) parts.push(`Next steps: ${a.nextSteps.join("; ")}.`);
  if (!parts.length && research.benchmark.insights.length) parts.push(research.benchmark.insights.join(" "));
  if (!parts.length) parts.push(`${idea.title}: market scan`);
  return parts.join(" ").slice(0, 1024);
}

// Crude opportunity score on RSI's 0..100 trigger scale: retail average vs the
// cheapest supplier (higher margin -> higher score).
function marginScore(research: ResearchResult): number {
  const pr = research.benchmark.priceRange;
  const lows = (research.suppliers ?? [])
    .map((s) => parsePrice(s.price).value)
    .filter((v): v is number => v != null && v > 0);
  if (pr && lows.length && pr.avg > 0) {
    return Math.max(0, Math.min(100, Math.round((1 - Math.min(...lows) / pr.avg) * 100)));
  }
  return 50;
}

async function writeTrigger(
  sb: SupabaseClient,
  categoryId: number | null,
  idea: ProductIdea,
  research: ResearchResult
): Promise<void> {
  await sb.from("triggers").insert({
    category_id: categoryId,
    score: marginScore(research),
    rationale: buildRationale(idea, research),
    status: "new",
    payload: {
      kind: "validate_idea",
      idea_id: idea.id,
      idea: { title: idea.title, category: idea.category },
      suggested_price: research.analysis?.suggestedPrice ?? null,
      price_range: research.benchmark.priceRange,
      competitors: research.benchmark.competitors.slice(0, 5).map((c) => ({
        name: c.name,
        brand: c.brand,
        price: c.price,
        rating: c.rating ?? null,
      })),
      suppliers: (research.suppliers ?? []).slice(0, 5).map((s) => ({
        name: s.name,
        price: s.price ?? null,
        orders: s.orders ?? null,
        source: s.source ?? null,
        url: s.url,
      })),
    },
  });
}

export async function connectResearch(
  idea: ProductIdea,
  research: ResearchResult
): Promise<{ categoryId: number | null }> {
  if (!supabaseAdminEnabled()) return { categoryId: null };
  const sb = supabaseAdmin()!;
  let categoryId: number | null = null;
  try {
    const catName = research.classification?.category || idea.category;
    categoryId = await resolveCategoryId(sb, catName, research.classification?.keywords ?? []);
    if (categoryId != null) {
      await sb.from("product_ideas").update({ category_id: categoryId }).eq("id", idea.id);
    }
    const codes = await validCountryCodes(sb);
    await Promise.allSettled([
      writeSuppliers(sb, categoryId, research.suppliers ?? [], codes),
      writeCompetitors(sb, research.makers ?? []),
      writeTrigger(sb, categoryId, idea, research),
    ]);
  } catch {
    // never block the research response on a write-back failure
  }
  return { categoryId };
}
