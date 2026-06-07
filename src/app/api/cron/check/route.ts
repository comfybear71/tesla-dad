import { NextResponse } from "next/server";
import {
  getConfig,
  addSnapshot,
  getLastSignalKey,
  setLastSignalKey,
  getDailyState,
  setDailyState,
  type DailyState,
} from "@/lib/store";
import { getQuote } from "@/lib/price";
import { computeSignal, signalKey } from "@/lib/signals";
import { sendTelegram, formatSignalMessage, formatMarketSummary } from "@/lib/telegram";
import { nyTime, MARKET_OPEN_MIN, MARKET_CLOSE_MIN } from "@/lib/market";
import type { Quote, Signal } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron entrypoint (configured in vercel.json to run every 15 min).
 *
 * 1. Fetch the latest real price and store a snapshot for the chart.
 * 2. Send the daily market OPEN / CLOSE summary to Telegram (once each per ET day).
 * 3. Compute the current signal; if it's an actionable BUY/SELL we haven't
 *    already notified for, send a Telegram alert.
 *
 * If no price source is configured, this no-ops with a clear message rather than
 * inventing data. Optional: set CRON_SECRET to require an Authorization header.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const config = await getConfig();

  let quote: Quote;
  try {
    quote = await getQuote(config.symbol);
  } catch (e) {
    return NextResponse.json(
      { ok: false, code: "NO_PRICE_SOURCE", error: (e as Error).message },
      { status: 503 },
    );
  }

  await addSnapshot({ ts: quote.ts, price: quote.price });

  const signal = computeSignal(config, quote.price);

  // --- Daily market open / close summaries ---
  const summary = await maybeSendDailySummary(quote, signal);

  // --- Tier-crossing signal alert (de-duped) ---
  const key = signalKey(signal);
  const lastKey = await getLastSignalKey();
  let notified = false;
  if (signal.action !== "HOLD" && key !== lastKey) {
    notified = await sendTelegram(formatSignalMessage(signal));
  }
  await setLastSignalKey(key);

  return NextResponse.json({
    ok: true,
    price: quote.price,
    source: quote.source,
    action: signal.action,
    tier: signal.tierLabel,
    notified,
    summary,
  });
}

/**
 * Sends the open summary on the first run at/after 09:30 ET, and the close
 * summary on the first run at/after 16:00 ET, each at most once per ET weekday.
 * Returns which summary (if any) was sent.
 */
async function maybeSendDailySummary(
  quote: Quote,
  signal: Signal,
): Promise<"open" | "close" | null> {
  const ny = nyTime();
  if (!ny.isWeekday) return null;

  // Reset the per-day flags when the ET date rolls over.
  const existing = await getDailyState();
  const state: DailyState =
    existing && existing.date === ny.dateStr
      ? existing
      : { date: ny.dateStr, openSent: false, closeSent: false };

  // CLOSE: at/after 16:00 ET.
  if (ny.minutes >= MARKET_CLOSE_MIN && !state.closeSent) {
    const sent = await sendTelegram(formatMarketSummary("close", quote, signal));
    state.openSent = true; // don't fire a late "open" after the close
    state.closeSent = true;
    await setDailyState(state);
    return sent ? "close" : null;
  }

  // OPEN: during the session window (09:30–16:00 ET).
  if (ny.minutes >= MARKET_OPEN_MIN && ny.minutes < MARKET_CLOSE_MIN && !state.openSent) {
    const sent = await sendTelegram(formatMarketSummary("open", quote, signal));
    state.openSent = true;
    await setDailyState(state);
    return sent ? "open" : null;
  }

  // Persist a freshly-rolled-over state even if nothing was sent yet.
  if (!existing || existing.date !== ny.dateStr) await setDailyState(state);
  return null;
}
