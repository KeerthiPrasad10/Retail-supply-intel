import "server-only";

import { randomUUID } from "node:crypto";
import { supabaseAdmin, supabaseAdminEnabled } from "./supabase-admin";

/**
 * Persistence for feedback comments left on a product idea.
 *
 * - With Supabase configured (service-role key), comments live in the
 *   `product_idea_comments` table (see
 *   supabase/migrations/0007_product_idea_comments.sql and
 *   pipelines/src/rsi/models.py::ProductIdeaComment).
 * - Without it, a module-scoped in-memory map keeps the feature working for
 *   build/runtime. Serverless cold starts reset it, which is acceptable for the
 *   demo flow (results are echoed back to the client on POST).
 */

export type IdeaComment = {
  id: string;
  ideaId: string;
  author: string;
  body: string;
  createdAt: string;
};

const TABLE = "product_idea_comments";

// In-memory fallback, keyed by ideaId.
const mem = new Map<string, IdeaComment[]>();

/* ---------- Supabase row mapping ---------- */

function rowToComment(row: Record<string, unknown>): IdeaComment {
  return {
    id: String(row.id),
    ideaId: String(row.idea_id ?? ""),
    author: String(row.author ?? ""),
    body: String(row.body ?? ""),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

/* ---------- Public API ---------- */

export async function listComments(ideaId: string): Promise<IdeaComment[]> {
  if (supabaseAdminEnabled()) {
    const { data, error } = await supabaseAdmin()!
      .from(TABLE)
      .select("*")
      .eq("idea_id", ideaId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => rowToComment(r as Record<string, unknown>));
  }
  return [...(mem.get(ideaId) ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function addComment(
  ideaId: string,
  input: { author?: string; body: string }
): Promise<IdeaComment> {
  const author = (input.author || "").trim();
  const comment: IdeaComment = {
    id: randomUUID(),
    ideaId,
    author,
    body: input.body.trim(),
    createdAt: new Date().toISOString(),
  };

  if (supabaseAdminEnabled()) {
    const { data, error } = await supabaseAdmin()!
      .from(TABLE)
      .insert({
        id: comment.id,
        idea_id: comment.ideaId,
        author: comment.author || null,
        body: comment.body,
        created_at: comment.createdAt,
      })
      .select("*")
      .single();
    if (error) throw error;
    return rowToComment(data as Record<string, unknown>);
  }

  const list = mem.get(ideaId) ?? [];
  list.push(comment);
  mem.set(ideaId, list);
  return comment;
}
