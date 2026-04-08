import { Dashboard } from "@/components/dashboard";
import { loadDashboardState } from "@/lib/state";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initialState = await loadDashboardState();

  return <Dashboard initialState={initialState} />;
}
