import { NextResponse } from "next/server";
import { getConfig, saveConfig } from "@/lib/store";
import type { Config } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getConfig());
}

export async function POST(req: Request) {
  const current = await getConfig();
  const body = (await req.json()) as Partial<Config>;
  const merged: Config = {
    ...current,
    ...body,
    tiers: body.tiers ?? current.tiers,
  };
  // If the baseline changed, stamp the time.
  if (body.baselinePrice != null && body.baselinePrice !== current.baselinePrice) {
    merged.baselineSetAt = new Date().toISOString();
  }
  await saveConfig(merged);
  return NextResponse.json(merged);
}
