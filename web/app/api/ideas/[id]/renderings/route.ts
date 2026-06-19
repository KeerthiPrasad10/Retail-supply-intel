import { NextResponse } from "next/server";
import { getIdea } from "@/lib/ideas/store";
import { generateRenderings } from "@/lib/ideas/renderings";
import type { ProductIdea } from "@/lib/ideas/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let body: { idea?: ProductIdea } = {};
  try { body = await req.json(); } catch { /* ok */ }

  const idea = body.idea ?? await getIdea(params.id);
  if (!idea) return NextResponse.json({ error: "Idea not found" }, { status: 404 });

  const { renderings, error } = await generateRenderings(idea);
  return NextResponse.json({ renderings, error });
}
