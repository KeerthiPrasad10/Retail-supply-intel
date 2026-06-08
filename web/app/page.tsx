import Link from "next/link";
import { TriggerCard } from "@/components/TriggerCard";
import { getSnapshot, getTriggers } from "@/lib/data";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-edge bg-panel p-4">
      <div className="text-2xl font-semibold tabular-nums text-white">{value}</div>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}

export default async function OverviewPage() {
  const snap = await getSnapshot();
  const triggers = await getTriggers();
  const names = Object.fromEntries(snap.countries.map((c) => [c.code, c.name]));
  const emergingMarkets = new Set(
    triggers.flatMap((t) => (t.payload.emerging_suppliers ?? []).map((s) => s.partner_code)),
  );

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold text-white">Sourcing intelligence</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          Where rising consumer demand meets the international supply chain. Each trigger pairs an
          accelerating trend with the countries it&apos;s sourced from — surfacing emerging
          suppliers before competitors lock them in.
        </p>
        <p className="mt-2 text-xs text-gray-600">
          Snapshot generated {new Date(snap.generated_at).toLocaleString()}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Active triggers" value={triggers.length} />
        <Stat label="Trends tracked" value={snap.trends.length} />
        <Stat label="Categories" value={snap.categories.length} />
        <Stat label="Emerging origins" value={emergingMarkets.size} />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Top triggers</h2>
          <Link href="/triggers" className="text-sm text-accent hover:underline">
            View all →
          </Link>
        </div>
        <div className="grid gap-4">
          {triggers.slice(0, 3).map((t) => (
            <TriggerCard key={t.id} trigger={t} names={names} />
          ))}
        </div>
      </section>
    </div>
  );
}
