import { NextResponse } from "next/server";
import { getQuote } from "@/lib/price";
import { getConfig } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getConfig();
  try {
    const quote = await getQuote(config.symbol);
    return NextResponse.json(quote);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, code: "NO_PRICE_SOURCE" },
      { status: 503 },
    );
  }
}
