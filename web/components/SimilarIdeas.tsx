"use client";

import { useEffect, useRef, useState } from "react";
import type { SimilarIdea } from "@/lib/ideas/store";
import { cc } from "@/lib/util";
import { Icons } from "./icons";

const STATUS_LABEL: Record<SimilarIdea["status"], { cls: string; label: string }> = {
  queued: { cls: "", label: "queued" },
  researching: { cls: "med", label: "researching" },
  complete: { cls: "low", label: "researched" },
  error: { cls: "high", label: "error" },
};

/**
 * Shows existing ideas similar to the one being submitted, so the submitter can
 * see what the team has already proposed (avoid duplicates, build on prior work).
 * Debounced; renders nothing until there's a match.
 */
export function SimilarIdeas({
  title,
  category,
  features,
  description,
}: {
  title: string;
  category?: string;
  features?: string;
  description?: string;
}) {
  const [ideas, setIdeas] = useState<SimilarIdea[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const t = (title || "").trim();
    // Need a bit of signal before querying.
    if (t.length < 3 && !(category || "").trim()) {
      setIdeas([]);
      return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fetch("/api/ideas/similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, features, description }),
      })
        .then((r) => r.json())
        .then((d) => setIdeas(Array.isArray(d?.ideas) ? d.ideas : []))
        .catch(() => {});
    }, 450);
    return () => clearTimeout(timer.current);
  }, [title, category, features, description]);

  if (!ideas.length) return null;

  return (
    <section className="similar-ideas">
      <p className="similar-ideas-head">
        <Icons.box size={13} /> Similar ideas already submitted
        <span className="similar-ideas-count">{ideas.length}</span>
      </p>
      <p className="similar-ideas-sub">
        The team has proposed these — worth a look before you submit.
      </p>
      <div className="similar-ideas-list">
        {ideas.map((i) => {
          const s = STATUS_LABEL[i.status] ?? STATUS_LABEL.queued;
          return (
            <div key={i.id} className="similar-card">
              <div className="similar-thumb">
                {i.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.imageUrl} alt={i.title} />
                ) : (
                  <Icons.box size={16} />
                )}
              </div>
              <div className="similar-body">
                <p className="similar-title">{i.title}</p>
                <p className="similar-meta">
                  {[i.category, i.submittedBy].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <span className={cc("badge", s.cls)}>{s.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
