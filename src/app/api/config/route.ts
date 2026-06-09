import { NextResponse } from "next/server";
import { getConfig, saveConfig, resolveSymbol } from "@/lib/store";
import type { Config } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const symbol = await resolveSymbol(new URL(req.url).searchParams.get("symbol"));
  return NextResponse.json(await getConfig(symbol));
}

export async function POST(req: Request) {
  const symbol = await resolveSymbol(new URL(req.url).searchParams.get("symbol"));
  const current = await getConfig(symbol);
  const body = (await req.json()) as Partial<Config>;
  const merged: Config = {
    ...current,
    ...body,
    symbol, // the symbol is fixed by the route, never by the body
    tiers: body.tiers ?? current.tiers,
  };
  // If the baseline changed, stamp the time.
  if (body.baselinePrice != null && body.baselinePrice !== current.baselinePrice) {
    merged.baselineSetAt = new Date().toISOString();
  }
  await saveConfig(merged);
  return NextResponse.json(merged);
}
