import { NextResponse } from "next/server";
import { getConfig } from "@/lib/store";
import { getQuote } from "@/lib/price";
import { computeSignal } from "@/lib/signals";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getConfig();
  try {
    const quote = await getQuote(config.symbol);
    const signal = computeSignal(config, quote.price);
    return NextResponse.json({ signal, quote, config });
  } catch (e) {
    // No fabricated numbers: report the missing data source honestly.
    return NextResponse.json(
      { error: (e as Error).message, code: "NO_PRICE_SOURCE", config },
      { status: 503 },
    );
  }
}
