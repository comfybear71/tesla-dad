import { NextResponse } from "next/server";
import { getConfig } from "@/lib/store";
import { getQuote } from "@/lib/price";
import { computeSignal } from "@/lib/signals";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getConfig();
  const quote = await getQuote(config.symbol);
  const signal = computeSignal(config, quote.price);
  return NextResponse.json({ signal, quote, config });
}
