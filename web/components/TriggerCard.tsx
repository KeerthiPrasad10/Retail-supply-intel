import { num, pct } from "@/lib/format";
import type { Trigger } from "@/lib/types";
import { SourceBars } from "./SourceBars";

export function TriggerCard({
  trigger,
  names,
}: {
  trigger: Trigger;
  names: Record<string, string>;
}) {
  const t = trigger;
  return (
    <article className="rounded-xl border border-edge bg-panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="rounded bg-edge px-2 py-0.5 text-gray-300">{t.category}</span>
            <span>·</span>
            <span>{t.market}</span>
          </div>
          <h3 className="mt-1 text-base font-semibold text-white">
            Source {t.category} from{" "}
            <span className="text-accent">{t.focus_partner_name}</span>
          </h3>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums text-white">{num(t.score)}</div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500">score</div>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-gray-300">{t.rationale}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Origin breakdown
          </h4>
          <SourceBars sources={t.payload.top_sources ?? []} names={names} limit={5} />
        </div>
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Signals
          </h4>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-400">Demand momentum</dt>
              <dd className="tabular-nums text-gray-200">{num(t.payload.demand_momentum ?? 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-400">Demand growth</dt>
              <dd className="tabular-nums text-accent">{pct(t.payload.demand_growth ?? 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-400">Emerging origins</dt>
              <dd className="tabular-nums text-gray-200">
                {(t.payload.emerging_suppliers ?? []).length}
              </dd>
            </div>
            {(t.payload.competitors ?? []).length > 0 && (
              <div className="flex justify-between">
                <dt className="text-gray-400">Competitors</dt>
                <dd className="text-gray-200">{(t.payload.competitors ?? []).join(", ")}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </article>
  );
}
