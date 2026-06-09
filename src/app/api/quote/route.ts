import { NextResponse } from "next/server";
import { getQuote } from "@/lib/price";
import { resolveSymbol } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const symbol = await resolveSymbol(new URL(req.url).searchParams.get("symbol"));
  try {
    const quote = await getQuote(symbol);
    return NextResponse.json(quote);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, code: "NO_PRICE_SOURCE" },
      { status: 503 },
    );
  }
}
