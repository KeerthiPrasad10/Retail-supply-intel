import { TriggerCard } from "@/components/TriggerCard";
import { getSnapshot, getTriggers } from "@/lib/data";

export const metadata = { title: "Triggers · Retail Supply Intel" };

export default async function TriggersPage() {
  const snap = await getSnapshot();
  const triggers = await getTriggers();
  const names = Object.fromEntries(snap.countries.map((c) => [c.code, c.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Sourcing triggers</h1>
        <p className="mt-1 text-sm text-gray-400">
          Ranked demand×supply opportunities. A high score means demand is accelerating in a market
          while a new origin country is gaining share for that category.
        </p>
      </div>
      <div className="grid gap-4">
        {triggers.map((t) => (
          <TriggerCard key={t.id} trigger={t} names={names} />
        ))}
      </div>
    </div>
  );
}
