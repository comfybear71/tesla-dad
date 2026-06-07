import { NextResponse } from "next/server";
import { getSnapshots, getTrades } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const [snapshots, trades] = await Promise.all([getSnapshots(), getTrades()]);
  return NextResponse.json({ snapshots, trades });
}
