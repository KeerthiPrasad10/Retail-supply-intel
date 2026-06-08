import { num, pct } from "@/lib/format";
import { getTrends } from "@/lib/data";

export const metadata = { title: "Trends · Retail Supply Intel" };

export default async function TrendsPage() {
  const trends = await getTrends();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Demand trends</h1>
        <p className="mt-1 text-sm text-gray-400">
          Per-category, per-market interest momentum from Wikipedia pageviews and Google Trends. A
          recent window is compared against the prior one; momentum weights growth by volume.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-edge">
        <table className="w-full text-sm">
          <thead className="bg-panel text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Market</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 text-right font-medium">Momentum</th>
              <th className="px-4 py-3 text-right font-medium">Growth</th>
              <th className="px-4 py-3 text-right font-medium">Volume</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {trends.map((t, i) => (
              <tr key={i} className="bg-ink/40 hover:bg-panel/60">
                <td className="px-4 py-2.5 text-gray-200">{t.category ?? t.term}</td>
                <td className="px-4 py-2.5 text-gray-300">{t.country}</td>
                <td className="px-4 py-2.5 text-gray-500">{t.platform}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-white">
                  {num(t.momentum)}
                </td>
                <td
                  className={`px-4 py-2.5 text-right tabular-nums ${
                    t.growth >= 0 ? "text-accent" : "text-rose-400"
                  }`}
                >
                  {pct(t.growth)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">
                  {num(t.volume, 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
