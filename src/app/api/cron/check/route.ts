import { NextResponse } from "next/server";
import {
  getConfig,
  addSnapshot,
  getLastSignalKey,
  setLastSignalKey,
} from "@/lib/store";
import { getQuote } from "@/lib/price";
import { computeSignal, signalKey } from "@/lib/signals";
import { sendTelegram, formatSignalMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron entrypoint (configured in vercel.json to run every 15 min).
 *
 * 1. Fetch the latest price and store a snapshot for the chart.
 * 2. Compute the current signal.
 * 3. If it's an actionable BUY/SELL we haven't already notified for, send Telegram.
 *
 * Optional: set CRON_SECRET to require an Authorization header (Vercel adds it
 * automatically to scheduled invocations).
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
  const quote = await getQuote(config.symbol);
  await addSnapshot({ ts: quote.ts, price: quote.price });

  const signal = computeSignal(config, quote.price);
  const key = signalKey(signal);
  const lastKey = await getLastSignalKey();

  let notified = false;
  if (signal.action !== "HOLD" && key !== lastKey) {
    notified = await sendTelegram(formatSignalMessage(signal));
  }
  // Always update the dedupe key so we re-notify only when the condition changes.
  await setLastSignalKey(key);

  return NextResponse.json({
    ok: true,
    price: quote.price,
    source: quote.source,
    action: signal.action,
    tier: signal.tierLabel,
    notified,
  });
}
