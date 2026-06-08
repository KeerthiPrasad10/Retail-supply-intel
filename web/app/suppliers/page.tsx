import { SourceBars } from "@/components/SourceBars";
import { getSnapshot } from "@/lib/data";

export const metadata = { title: "Suppliers · Retail Supply Intel" };

export default async function SuppliersPage() {
  const snap = await getSnapshot();
  const names = Object.fromEntries(snap.countries.map((c) => [c.code, c.name]));

  const cards = snap.categories
    .map((cat) => ({ cat, sources: snap.sources[String(cat.id)] ?? [] }))
    .filter((c) => c.sources.length > 0)
    .sort((a, b) => {
      const ea = a.sources.filter((s) => s.emerging).length;
      const eb = b.sources.filter((s) => s.emerging).length;
      return eb - ea;
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Supplier origins</h1>
        <p className="mt-1 text-sm text-gray-400">
          Where each category is sourced from, by import value (UN Comtrade). Bars show share of the
          latest period; <span className="text-accent">emerging</span> origins are gaining share —
          the candidates worth investigating.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map(({ cat, sources }) => (
          <section key={cat.id} className="rounded-xl border border-edge bg-panel p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-white">{cat.name}</h2>
              {cat.hs_code && (
                <span className="rounded bg-edge px-2 py-0.5 text-xs text-gray-400">
                  HS {cat.hs_code}
                </span>
              )}
            </div>
            <SourceBars sources={sources} names={names} limit={6} />
          </section>
        ))}
      </div>
    </div>
  );
}
