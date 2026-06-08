import { pct } from "@/lib/format";
import type { SourceEntry } from "@/lib/types";

export function SourceBars({
  sources,
  names,
  limit = 6,
}: {
  sources: SourceEntry[];
  names: Record<string, string>;
  limit?: number;
}) {
  const top = sources.slice(0, limit);
  if (top.length === 0) {
    return <p className="text-sm text-gray-500">No trade-flow data for this category yet.</p>;
  }
  const max = Math.max(...top.map((s) => s.share), 0.0001);

  return (
    <ul className="space-y-2">
      {top.map((s) => (
        <li key={s.partner_code} className="text-sm">
          <div className="mb-1 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="text-gray-200">{names[s.partner_code] ?? s.partner_code}</span>
              {s.emerging && (
                <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium uppercase text-accent">
                  emerging
                </span>
              )}
            </span>
            <span className="tabular-nums text-gray-400">
              {pct(s.share, false)}{" "}
              <span className={s.growth >= 0 ? "text-accent" : "text-rose-400"}>
                {pct(s.growth)}
              </span>
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded bg-edge">
            <div
              className={s.emerging ? "h-full bg-accent" : "h-full bg-gray-500"}
              style={{ width: `${(s.share / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
