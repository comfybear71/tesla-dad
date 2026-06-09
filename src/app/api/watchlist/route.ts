import { NextResponse } from "next/server";
import { getWatchlist, saveWatchlist, normalizeSymbol } from "@/lib/store";
import { getQuote } from "@/lib/price";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ symbols: await getWatchlist() });
}

/**
 * Add a ticker to the watchlist. The symbol must be covered by a real market
 * data feed before it's accepted — companies that aren't publicly listed yet
 * (SpaceX, Anthropic, OpenAI, …) are rejected honestly instead of being faked,
 * and can be added the day they list.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { symbol?: string };
  const symbol = normalizeSymbol(body.symbol);
  if (!symbol) {
    return NextResponse.json(
      { error: "Enter a valid ticker symbol, e.g. NVDA." },
      { status: 400 },
    );
  }

  const symbols = await getWatchlist();
  if (symbols.includes(symbol)) {
    return NextResponse.json({ error: `${symbol} is already tracked.` }, { status: 409 });
  }

  try {
    await getQuote(symbol);
  } catch {
    return NextResponse.json(
      {
        error: `No live market data for ${symbol}. If it isn't publicly listed yet (SpaceX, Anthropic and OpenAI aren't), it can be added the day a real price feed covers it.`,
      },
      { status: 422 },
    );
  }

  const updated = [...symbols, symbol];
  await saveWatchlist(updated);
  return NextResponse.json({ symbols: updated });
}

/** Remove a ticker. Its stored config/trades are kept, so re-adding restores them. */
export async function DELETE(req: Request) {
  const symbol = normalizeSymbol(new URL(req.url).searchParams.get("symbol"));
  const symbols = await getWatchlist();
  if (!symbol || !symbols.includes(symbol)) {
    return NextResponse.json({ error: "Symbol not tracked." }, { status: 404 });
  }
  if (symbols.length === 1) {
    return NextResponse.json({ error: "Keep at least one symbol." }, { status: 400 });
  }
  const updated = symbols.filter((s) => s !== symbol);
  await saveWatchlist(updated);
  return NextResponse.json({ symbols: updated });
}
