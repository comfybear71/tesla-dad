import { NextResponse } from "next/server";
import { getConfig, saveConfig, saveTrades } from "@/lib/store";
import { addSnapshot, getSnapshots } from "@/lib/store";
import type { Trade } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Seed demo price history + a couple of sample trades so the chart and table
 * look alive before any real data is collected. Safe to run anytime; it only
 * seeds when there are no snapshots yet (or pass ?force=1).
 *
 * POST /api/seed
 */
export async function POST(req: Request) {
  const force = new URL(req.url).searchParams.get("force") === "1";
  const existing = await getSnapshots();
  if (existing.length > 0 && !force) {
    return NextResponse.json({ seeded: false, reason: "snapshots already exist; pass ?force=1" });
  }

  // 60 days of synthetic daily prices wandering around ~$330.
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  let price = 300;
  const snaps: { ts: string; price: number }[] = [];
  for (let i = 60; i >= 0; i--) {
    price += Math.sin(i / 4) * 6 + (Math.random() - 0.48) * 10;
    price = Math.max(220, Math.min(420, price));
    snaps.push({ ts: new Date(now - i * day).toISOString(), price: +price.toFixed(2) });
  }
  // Reset and write fresh snapshots.
  for (const s of snaps) await addSnapshot(s);

  const config = await getConfig();
  const trades: Trade[] = [
    {
      id: "seed-1",
      ts: new Date(now - 40 * day).toISOString(),
      action: "BUY",
      tierLabel: "Tier 2",
      price: snaps[20].price,
      shares: 4,
      amountUsd: +(snaps[20].price * 4).toFixed(2),
      feeUsd: +(snaps[20].price * 4 * 0.001).toFixed(2),
      sharesAfter: 54,
      cashAfter: 3500,
      note: "Demo buy on a dip",
    },
    {
      id: "seed-2",
      ts: new Date(now - 18 * day).toISOString(),
      action: "SELL",
      tierLabel: "Tier 1",
      price: snaps[42].price,
      shares: 1,
      amountUsd: +(snaps[42].price * 1).toFixed(2),
      feeUsd: +(snaps[42].price * 0.001).toFixed(2),
      sharesAfter: 53,
      cashAfter: 3500 + snaps[42].price,
      note: "Demo sell on a rally",
    },
  ];
  await saveTrades(trades);
  await saveConfig({ ...config, baselinePrice: snaps[snaps.length - 1].price });

  return NextResponse.json({ seeded: true, snapshots: snaps.length, trades: trades.length });
}
