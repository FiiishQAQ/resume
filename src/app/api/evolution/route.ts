import { NextResponse } from "next/server";

import { getEvolutionSnapshots } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getEvolutionSnapshots());
}
