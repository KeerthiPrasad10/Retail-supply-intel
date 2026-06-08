import type { TrendSummary } from "@/lib/types";

/** Renders the opportunity summary as what / why / impact. */
export function SummaryBlock({ summary }: { summary: TrendSummary }) {
  return (
    <dl className="summary">
      <div>
        <dt>Change</dt>
        <dd>{summary.change}</dd>
      </div>
      <div>
        <dt>Why</dt>
        <dd>{summary.why}</dd>
      </div>
      <div>
        <dt>Impact</dt>
        <dd>{summary.impact}</dd>
      </div>
    </dl>
  );
}
