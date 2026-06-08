import { SupplyMap } from "@/components/SupplyMap";
import { getFlows, getSnapshot } from "@/lib/data";
import { compactUsd, pct } from "@/lib/format";

export const metadata = { title: "Supply map · Retail Supply Intel" };

export default async function MapPage() {
  const snap = await getSnapshot();
  const flows = await getFlows();

  const topFlows = [...flows].sort((a, b) => b.value - a.value).slice(0, 12);
  const emerging = flows
    .filter((f) => f.emerging)
    .sort((a, b) => b.growth - a.growth)
    .slice(0, 12);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Supply map</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          Where the top categories are sourced from across Asia, and which buyer markets they flow
          into. Line weight is import value; <span className="text-accent">green</span> lines are
          emerging flows (≥15% growth). Source: UN Comtrade, latest period.
        </p>
      </div>

      <SupplyMap flows={flows} countries={snap.countries} categories={snap.categories} />

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-edge bg-panel p-5">
          <h2 className="mb-3 text-sm font-semibold text-white">Largest flows</h2>
          <ul className="space-y-2 text-sm">
            {topFlows.map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="text-gray-300">
                  {f.origin} → {f.market} <span className="text-gray-500">· {f.category}</span>
                </span>
                <span className="tabular-nums text-white">{compactUsd(f.value)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-edge bg-panel p-5">
          <h2 className="mb-3 text-sm font-semibold text-white">
            Emerging flows <span className="text-accent">↑</span>
          </h2>
          <ul className="space-y-2 text-sm">
            {emerging.length === 0 && <li className="text-gray-500">No emerging flows this period.</li>}
            {emerging.map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="text-gray-300">
                  {f.origin} → {f.market} <span className="text-gray-500">· {f.category}</span>
                </span>
                <span className="tabular-nums text-accent">{pct(f.growth)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
