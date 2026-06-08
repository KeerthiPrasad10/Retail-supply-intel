import { getLeadingIndicators } from "@/lib/data";
import { num, pct } from "@/lib/format";

export const metadata = { title: "Leading signals · Retail Supply Intel" };

export default async function SignalsPage() {
  const signals = await getLeadingIndicators();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">About to trend</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          Leading indicators ranked by <span className="text-accent">acceleration</span> — the
          change in demand growth between the two most recent windows. Positive acceleration flags a
          category/market whose interest is speeding up, often before raw momentum is high.
        </p>
      </div>

      {signals.length === 0 ? (
        <p className="rounded-xl border border-edge bg-panel p-6 text-sm text-gray-500">
          No accelerating signals in the latest snapshot.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-edge">
          <table className="w-full text-sm">
            <thead className="bg-panel text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Market</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 text-right font-medium">Acceleration</th>
                <th className="px-4 py-3 text-right font-medium">Momentum</th>
                <th className="px-4 py-3 text-right font-medium">Growth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {signals.map((s, i) => (
                <tr key={i} className="bg-ink/40 hover:bg-panel/60">
                  <td className="px-4 py-2.5 tabular-nums text-gray-500">{i + 1}</td>
                  <td className="px-4 py-2.5 text-gray-200">{s.category ?? s.term}</td>
                  <td className="px-4 py-2.5 text-gray-300">{s.country}</td>
                  <td className="px-4 py-2.5 text-gray-500">{s.platform}</td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums text-accent">
                    {num(s.acceleration)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-300">
                    {num(s.momentum)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right tabular-nums ${
                      s.growth >= 0 ? "text-accent" : "text-rose-400"
                    }`}
                  >
                    {pct(s.growth)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
