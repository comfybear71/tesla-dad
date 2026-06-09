import { NextResponse } from "next/server";
import { getConfig, resolveSymbol } from "@/lib/store";
import { getQuote } from "@/lib/price";
import { computeSignal } from "@/lib/signals";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const symbol = await resolveSymbol(new URL(req.url).searchParams.get("symbol"));
  const config = await getConfig(symbol);
  try {
    const quote = await getQuote(symbol);
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
