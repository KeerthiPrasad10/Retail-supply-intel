import { NextResponse } from "next/server";

import { createIdea, listIdeas } from "@/lib/ideas/store";

/**
 * Product-idea collection endpoint for the "Validate" view.
 *
 *   GET  /api/ideas  → { ideas }      list submitted ideas (newest first)
 *   POST /api/ideas  → { idea }       create a queued idea (then the client
 *                                      POSTs /api/ideas/[id]/research to run it)
 *
 * Persistence falls back to an in-memory store when Supabase is not configured,
 * so the feature works without a database. Heavy AI work lives in the research
 * route, never here.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const ideas = await listIdeas();
  return NextResponse.json({ ideas });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.title || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "A product title is required." }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const idea = await createIdea({
    title: body.title,
    description: str(body.description),
    category: str(body.category),
    targetMarket: str(body.targetMarket),
    audience: str(body.audience),
    priceTarget: str(body.priceTarget),
    features: str(body.features),
    imageUrl: str(body.imageUrl),
    submittedBy: str(body.submittedBy),
  });

  return NextResponse.json({ idea }, { status: 201 });
}
