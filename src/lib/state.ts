import "server-only";

import { getDashboardState } from "@/lib/db/queries";

export async function loadDashboardState() {
  return getDashboardState();
}
