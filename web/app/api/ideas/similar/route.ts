import { NextResponse } from "next/server";

import { findSimilarIdeas } from "@/lib/ideas/store";

/**
 * POST /api/ideas/similar  { title?, category?, features?, description? }
 * → { ideas }   existing ideas similar to the in-progress draft, so the
 *               submitter can see what the team has already proposed.
 *
 * Read-only and cheap (in-memory scoring over the ideas list). Returns [] when
 * there's nothing to match on yet.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ideas: [] });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const draft = {
    title: str(body.title),
    category: str(body.category),
    features: str(body.features),
    description: str(body.description),
  };

  // Need at least a title or category to find anything meaningful.
  if (!draft.title && !draft.category) return NextResponse.json({ ideas: [] });

  try {
    const ideas = await findSimilarIdeas(draft, 4);
    return NextResponse.json({ ideas });
  } catch {
    return NextResponse.json({ ideas: [] });
  }
}
