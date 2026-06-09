import { NextResponse } from "next/server";
import { addTrade, getTrades, getConfig, saveConfig, resolveSymbol } from "@/lib/store";
import { estimateFee } from "@/lib/signals";
import type { Trade } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const symbol = await resolveSymbol(new URL(req.url).searchParams.get("symbol"));
  return NextResponse.json(await getTrades(symbol));
}

/**
 * Record a manually-executed trade. This updates the portfolio (shares + cash)
 * and resets the strategy baseline to the trade price, so the next round of
 * tier deviations is measured from here.
 */
export async function POST(req: Request) {
  const symbol = await resolveSymbol(new URL(req.url).searchParams.get("symbol"));
  const body = (await req.json()) as {
    action: "BUY" | "SELL";
    price: number;
    shares: number;
    tierLabel?: string | null;
    note?: string;
  };

  const config = await getConfig(symbol);
  const { action, price, shares } = body;
  if (!action || !price || !shares) {
    return NextResponse.json({ error: "action, price and shares are required" }, { status: 400 });
  }

  const gross = +(price * shares).toFixed(2);
  const fee = estimateFee(config, gross);

  let sharesAfter = config.sharesHeld;
  let cashAfter = config.cashUsd;
  let amountUsd: number;

  if (action === "BUY") {
    amountUsd = +(gross + fee).toFixed(2); // total cash out
    sharesAfter = +(config.sharesHeld + shares).toFixed(4);
    cashAfter = +(config.cashUsd - amountUsd).toFixed(2);
  } else {
    amountUsd = +(gross - fee).toFixed(2); // net cash in
    sharesAfter = +(config.sharesHeld - shares).toFixed(4);
    cashAfter = +(config.cashUsd + amountUsd).toFixed(2);
  }

  const trade: Trade = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    action,
    tierLabel: body.tierLabel ?? null,
    price,
    shares,
    amountUsd,
    feeUsd: fee,
    sharesAfter,
    cashAfter,
    note: body.note,
  };

  const trades = await addTrade(symbol, trade);

  // Update portfolio + reset baseline to the trade price.
  await saveConfig({
    ...config,
    sharesHeld: sharesAfter,
    cashUsd: cashAfter,
    baselinePrice: price,
    baselineSetAt: new Date().toISOString(),
  });

  return NextResponse.json({ trade, trades });
}
