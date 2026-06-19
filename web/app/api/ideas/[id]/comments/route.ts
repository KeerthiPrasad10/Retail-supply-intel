import { NextResponse } from "next/server";

import { addComment, listComments } from "@/lib/ideas/comments";

/**
 * Feedback comments for one product idea.
 *
 *   GET  /api/ideas/[id]/comments → { comments }  list (oldest first)
 *   POST /api/ideas/[id]/comments → { comment }   add a comment
 *
 * Persistence falls back to an in-memory store when Supabase is not configured,
 * so the feature works without a database.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const comments = await listComments(params.id);
    return NextResponse.json({ comments });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load comments." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body?.body !== "string" || !body.body.trim()) {
    return NextResponse.json({ error: "A comment body is required." }, { status: 400 });
  }
  if (body.body.length > 4096) {
    return NextResponse.json({ error: "Comment is too long (max 4096 characters)." }, { status: 400 });
  }
  if (body.author !== undefined && typeof body.author !== "string") {
    return NextResponse.json({ error: "Author must be a string." }, { status: 400 });
  }
  if (typeof body.author === "string" && body.author.length > 128) {
    return NextResponse.json({ error: "Name is too long (max 128 characters)." }, { status: 400 });
  }

  try {
    const comment = await addComment(params.id, {
      author: typeof body.author === "string" ? body.author : undefined,
      body: body.body,
    });
    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not add the comment." },
      { status: 500 }
    );
  }
}
