"use client";

import { useCallback, useEffect, useState } from "react";

import { cc } from "@/lib/util";
import { Icons } from "../icons";

/**
 * Self-contained feedback / comments thread for a single product idea.
 *
 * The IdeaComment type is defined inline (rather than imported from
 * lib/ideas/comments, which is "server-only") so this client component never
 * pulls the server-only store into the browser bundle.
 */
type IdeaComment = {
  id: string;
  ideaId: string;
  author: string;
  body: string;
  createdAt: string;
};

export function IdeaComments({ ideaId }: { ideaId: string }) {
  const [comments, setComments] = useState<IdeaComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [author, setAuthor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ideas/${ideaId}/comments`);
      const data = await res.json();
      setComments(Array.isArray(data?.comments) ? data.comments : []);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [ideaId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/ideas/${ideaId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author: author.trim() || undefined, body: body.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not post your comment.");
      if (data?.comment) {
        setComments((prev) => [...prev, data.comment as IdeaComment]);
      } else {
        await load();
      }
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post your comment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel idea-comments">
      <p className="panel-h section-h">
        <Icons.pulse size={13} /> Feedback &amp; comments
      </p>

      {loading ? (
        <p className="analysis-text muted idea-comment-empty">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="analysis-text muted idea-comment-empty">
          No comments yet — be the first to share feedback.
        </p>
      ) : (
        <ul className="idea-comments-list">
          {comments.map((c) => (
            <li key={c.id} className="idea-comment">
              <div className="idea-comment-head">
                <span className="idea-comment-author">{c.author || "Anonymous"}</span>
                <span className="idea-comment-date">
                  {new Date(c.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="idea-comment-body">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form className="idea-comment-form field" onSubmit={submit}>
        <div className="idea-comment-form-row">
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            maxLength={128}
            placeholder="Your name (optional)"
            className="nxb-input"
            aria-label="Your name (optional)"
          />
        </div>
        <div className="idea-comment-form-row">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4096}
            rows={3}
            placeholder="Share feedback on this product idea…"
            className="nxb-input"
            aria-label="Comment"
          />
        </div>

        {error && (
          <div className="callout warn">
            <Icons.alert size={15} />
            <p>{error}</p>
          </div>
        )}

        <div className="idea-comment-form-row">
          <button
            type="submit"
            className={cc("btn", "primary")}
            disabled={submitting || !body.trim()}
          >
            <Icons.plus size={14} /> {submitting ? "Posting…" : "Post comment"}
          </button>
        </div>
      </form>
    </section>
  );
}
