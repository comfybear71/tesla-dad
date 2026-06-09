import { NextResponse } from "next/server";
import {
  getConfig,
  getWatchlist,
  addSnapshot,
  getLastSignalKey,
  setLastSignalKey,
  getDailyState,
  setDailyState,
  type DailyState,
} from "@/lib/store";
import { getDailyBrief, saveDailyBrief } from "@/lib/store";
import { getQuote } from "@/lib/price";
import { computeSignal, signalKey } from "@/lib/signals";
import { sendTelegram, formatSignalMessage, formatMarketSummary } from "@/lib/telegram";
import { generateDailyBrief, formatBriefTelegram } from "@/lib/brief";
import { nyTime, MARKET_OPEN_MIN, MARKET_CLOSE_MIN } from "@/lib/market";
import type { Quote, Signal } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // multiple symbols + AI brief generation

interface SymbolResult {
  symbol: string;
  ok: boolean;
  error?: string;
  price?: number;
  source?: string;
  action?: Signal["action"];
  tier?: string | null;
  notified?: boolean;
  summary?: "open" | "close" | null;
}

/**
 * Vercel Cron entrypoint (configured in vercel.json to run every 15 min).
 *
 * For every symbol on the watchlist:
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

  const symbols = await getWatchlist();
  const results: SymbolResult[] = [];

  // Sequential on purpose: stays well inside free-tier API rate limits.
  for (const symbol of symbols) {
    results.push(await checkSymbol(symbol));
  }

  if (results.every((r) => !r.ok)) {
    return NextResponse.json(
      { ok: false, code: "NO_PRICE_SOURCE", results },
      { status: 503 },
    );
  }

  // AI daily brief: once per ET weekday, first run at/after the open.
  const brief = await maybeGenerateDailyBrief();

  return NextResponse.json({ ok: true, results, brief });
}

/**
 * Generates and stores the AI daily brief on the first weekday run at/after
 * 09:30 ET, then posts it to Telegram. Failures are logged but never break
 * the price/signal cron. No-ops without ANTHROPIC_API_KEY.
 */
async function maybeGenerateDailyBrief(): Promise<boolean> {
  if (!process.env.ANTHROPIC_API_KEY) return false;
  const ny = nyTime();
  if (!ny.isWeekday || ny.minutes < MARKET_OPEN_MIN) return false;
  const existing = await getDailyBrief();
  if (existing && existing.date === ny.dateStr) return false;
  try {
    const brief = await generateDailyBrief();
    await saveDailyBrief(brief);
    await sendTelegram(formatBriefTelegram(brief));
    return true;
  } catch (e) {
    console.error("daily brief generation failed:", (e as Error).message);
    return false;
  }
}

async function checkSymbol(symbol: string): Promise<SymbolResult> {
  const config = await getConfig(symbol);

  let quote: Quote;
  try {
    quote = await getQuote(symbol);
  } catch (e) {
    return { symbol, ok: false, error: (e as Error).message };
  }

  await addSnapshot(symbol, { ts: quote.ts, price: quote.price });

  const signal = computeSignal(config, quote.price);

  // --- Daily market open / close summaries ---
  const summary = await maybeSendDailySummary(symbol, quote, signal);

  // --- Tier-crossing signal alert (de-duped per symbol) ---
  const key = signalKey(signal);
  const lastKey = await getLastSignalKey(symbol);
  let notified = false;
  if (signal.action !== "HOLD" && key !== lastKey) {
    notified = await sendTelegram(formatSignalMessage(signal, symbol));
  }
  await setLastSignalKey(symbol, key);

  return {
    symbol,
    ok: true,
    price: quote.price,
    source: quote.source,
    action: signal.action,
    tier: signal.tierLabel,
    notified,
    summary,
  };
}

/**
 * Sends the open summary on the first run at/after 09:30 ET, and the close
 * summary on the first run at/after 16:00 ET, each at most once per ET weekday
 * per symbol. Returns which summary (if any) was sent.
 */
async function maybeSendDailySummary(
  symbol: string,
  quote: Quote,
  signal: Signal,
): Promise<"open" | "close" | null> {
  const ny = nyTime();
  if (!ny.isWeekday) return null;

  // Reset the per-day flags when the ET date rolls over.
  const existing = await getDailyState(symbol);
  const state: DailyState =
    existing && existing.date === ny.dateStr
      ? existing
      : { date: ny.dateStr, openSent: false, closeSent: false };

  // CLOSE: at/after 16:00 ET.
  if (ny.minutes >= MARKET_CLOSE_MIN && !state.closeSent) {
    const sent = await sendTelegram(formatMarketSummary("close", quote, signal));
    state.openSent = true; // don't fire a late "open" after the close
    state.closeSent = true;
    await setDailyState(symbol, state);
    return sent ? "close" : null;
  }

  // OPEN: during the session window (09:30–16:00 ET).
  if (ny.minutes >= MARKET_OPEN_MIN && ny.minutes < MARKET_CLOSE_MIN && !state.openSent) {
    const sent = await sendTelegram(formatMarketSummary("open", quote, signal));
    state.openSent = true;
    await setDailyState(symbol, state);
    return sent ? "open" : null;
  }

  // Persist a freshly-rolled-over state even if nothing was sent yet.
  if (!existing || existing.date !== ny.dateStr) await setDailyState(symbol, state);
  return null;
}
