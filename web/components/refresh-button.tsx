"use client";

import { useState } from "react";
import { Icons } from "./icons";

/** Header control that lets a user demand a fresh pull of signals without
 *  leaving the dashboard. Posts to the server route which dispatches the
 *  pipeline; surfaces the outcome through the existing toast. */
export function RefreshButton({ notify }: { notify: (msg: string) => void }) {
  const [pending, setPending] = useState(false);

  async function run() {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        notify("Refreshing signals — new data in a few minutes");
      } else if (res.status === 501) {
        notify("Refresh isn’t configured yet");
      } else {
        notify(data.error ? `Refresh failed: ${data.error}` : "Refresh failed");
      }
    } catch {
      notify("Refresh failed — please retry");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      className="btn secondary sm"
      onClick={run}
      disabled={pending}
      aria-label="refresh signals"
      title="Pull the latest signals"
    >
      <Icons.refresh size={14} style={pending ? { animation: "spin 0.9s linear infinite" } : undefined} />
      {pending ? "Refreshing…" : "Refresh"}
    </button>
  );
}
