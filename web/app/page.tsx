import { Dashboard } from "@/components/Dashboard";
import { loadSnapshot } from "@/lib/data";
import { buildModel } from "@/lib/model";

/**
 * Server entry. Loads the read-model from Supabase when configured (else the
 * committed snapshot), adapts it into the dashboard view-model, and hands it to
 * the interactive client shell.
 */
export default async function Page() {
  const snapshot = await loadSnapshot();
  const model = buildModel(snapshot);
  return <Dashboard model={model} />;
}
