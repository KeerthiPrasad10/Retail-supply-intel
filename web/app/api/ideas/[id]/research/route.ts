import { NextResponse } from "next/server";

import { runResearch } from "@/lib/ideas/agents";
import { connectResearch } from "@/lib/ideas/integration";
import { getIdea, updateIdea } from "@/lib/ideas/store";
import type { ProductIdea } from "@/lib/ideas/types";

/**
 * Runs the multi-agent research pipeline for one idea, persists the result, and
 * fans it out into RSI's shared tables (best-effort).
 *
 *   POST /api/ideas/[id]/research → { idea }   run the pipeline
 *   GET  /api/ideas/[id]/research → { status } poll current status
 *
 * Key resolution (server env only):
 *   ANTHROPIC_API_KEY || RSI_ANTHROPIC_API_KEY  → classifier + strategy analyst
 *   FIRECRAWL_API_KEY                           → web research / web suppliers
 *   APIFY_API_TOKEN                             → Amazon + AliExpress agents
 * With no keys the pipeline returns deterministic demo data so the page works.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const idea = await getIdea(params.id);
  if (!idea) return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  return NextResponse.json({ id: idea.id, status: idea.status, hasResearch: Boolean(idea.research) });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  // The client passes the full idea in the request body so this route works
  // without Supabase — the in-memory store doesn't survive across serverless
  // invocations (each Vercel function call is a separate process).
  let bodyIdea: ProductIdea | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.idea?.id) bodyIdea = body.idea as ProductIdea;
  } catch { /* ignore */ }

  let idea = await getIdea(params.id);
  if (!idea && bodyIdea) idea = bodyIdea;
  if (!idea) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  await updateIdea(idea.id, { status: "researching" });

  try {
    const research = await runResearch(idea);
    const updated = await updateIdea(idea.id, {
      status: research.error ? "error" : "complete",
      research,
    });
    // Fan results out into the shared RSI tables (best-effort, never blocks).
    if (!research.error) {
      await connectResearch(updated ?? idea, research);
    }
    return NextResponse.json({ idea: updated });
  } catch (err) {
    const updated = await updateIdea(idea.id, { status: "error" });
    return NextResponse.json(
      { idea: updated, error: err instanceof Error ? err.message : "Research failed" },
      { status: 500 }
    );
  }
}
