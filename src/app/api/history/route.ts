import { NextResponse } from "next/server";
import { getSnapshots, getTrades, getConfig, resolveSymbol } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const symbol = await resolveSymbol(new URL(req.url).searchParams.get("symbol"));
  const [snapshots, trades, config] = await Promise.all([
    getSnapshots(symbol),
    getTrades(symbol),
    getConfig(symbol),
  ]);
  return NextResponse.json({ snapshots, trades, baselinePrice: config.baselinePrice });
}
