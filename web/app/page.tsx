import { Dashboard } from "@/components/Dashboard";
import { buildModel } from "@/lib/model";
import type { Snapshot } from "@/lib/types";
import snapshot from "@/lib/snapshot.json";

/**
 * Server entry. Reads the committed pipeline snapshot, adapts it into the
 * dashboard view-model, and hands it to the interactive client shell. When
 * Supabase is wired, this is where a live query would replace the import.
 */
export default function Page() {
  const model = buildModel(snapshot as unknown as Snapshot);
  return <Dashboard model={model} />;
}
