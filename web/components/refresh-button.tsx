"use client";

import { useModel } from "./model-context";
import { Icons } from "./icons";

/** Freshness indicator in the header. The dashboard snapshot is refreshed
 *  automatically once a day by the `refresh.yml` GitHub Action (free demand +
 *  trade-flow connectors), so there is no on-demand pull to trigger from the
 *  browser. Clicking surfaces when the data was last updated and the daily
 *  cadence — it never calls the server, so it can't error. */
export function RefreshButton({ notify }: { notify: (msg: string) => void }) {
  const { snapshotLabel } = useModel();

  function explain() {
    notify(
      `Signals refresh automatically every day (~06:00 UTC). Last updated ${snapshotLabel}.`,
    );
  }

  return (
    <button
      className="btn secondary sm"
      onClick={explain}
      aria-label="data freshness"
      title="Signals refresh automatically every day (~06:00 UTC)"
    >
      <Icons.refresh size={14} />
      Updated {snapshotLabel}
    </button>
  );
}
