import { getCompetitors, getFlows } from "@/lib/data";
import { compactUsd } from "@/lib/format";

export const metadata = { title: "Competitors · Retail Supply Intel" };

export default async function CompetitorsPage() {
  const competitors = await getCompetitors();
  const flows = await getFlows();

  // Real Comtrade Asian-origin import mix for a competitor's home market.
  const marketOrigins = (marketCode: string | null) => {
    if (!marketCode) return [];
    const byOrigin = new Map<string, { origin: string; value: number }>();
    for (const f of flows) {
      if (f.market_code !== marketCode) continue;
      const cur = byOrigin.get(f.origin_code) ?? { origin: f.origin, value: 0 };
      cur.value += f.value;
      byOrigin.set(f.origin_code, cur);
    }
    return [...byOrigin.values()].sort((a, b) => b.value - a.value).slice(0, 5);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Competitors</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          Lidl&apos;s top-10 retail competitors (Kaufland excluded — it&apos;s part of LKA). Each
          card shows the Asian-origin import mix of the competitor&apos;s home market (UN Comtrade)
          and best-effort category sourcing.
        </p>
        <p className="mt-2 inline-block rounded bg-warn/15 px-2 py-1 text-xs text-warn">
          Sourcing links are researched, not customs-verified — company-level shipment data needs a
          paid bill-of-lading source.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {competitors.map((c) => {
          const origins = marketOrigins(c.home_country);
          const max = Math.max(1, ...origins.map((o) => o.value));
          return (
            <section key={c.id} className="rounded-xl border border-edge bg-panel p-5">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-semibold text-white">{c.name}</h2>
                <span className="text-xs text-gray-500">{c.home_market}</span>
              </div>

              <div className="mb-4">
                <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                  Home-market Asian imports
                </div>
                {origins.length === 0 && (
                  <p className="text-xs text-gray-600">No Comtrade data for this market/period.</p>
                )}
                <ul className="space-y-1.5">
                  {origins.map((o) => (
                    <li key={o.origin} className="text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">{o.origin}</span>
                        <span className="tabular-nums text-gray-400">{compactUsd(o.value)}</span>
                      </div>
                      <div className="mt-0.5 h-1.5 w-full rounded bg-edge">
                        <div
                          className="h-1.5 rounded bg-accent/70"
                          style={{ width: `${(o.value / max) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                  Sourcing (researched)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {c.sourcing.length === 0 && (
                    <span className="text-xs text-gray-600">No links yet.</span>
                  )}
                  {c.sourcing.map((s, i) => (
                    <span
                      key={i}
                      className="rounded bg-edge px-2 py-0.5 text-xs text-gray-300"
                      title="Researched, not customs-verified"
                    >
                      {s.category} · {s.partner}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
