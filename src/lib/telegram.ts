import type { Signal, Quote } from "./types";

/**
 * Send a message via the Telegram Bot API.
 *
 * Setup (one-time):
 *   1. In Telegram, message @BotFather, send /newbot, follow the prompts.
 *   2. Copy the bot token into TELEGRAM_BOT_TOKEN.
 *   3. Start a chat with your new bot and send it any message.
 *   4. Visit https://api.telegram.org/bot<TOKEN>/getUpdates to find your chat id,
 *      put it in TELEGRAM_CHAT_ID.
 *
 * Returns true if sent, false if not configured or the send failed.
 */
export async function sendTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const ICON: Record<Signal["action"], string> = {
  BUY: "🟢",
  SELL: "🔴",
  HOLD: "⚪️",
};

/** Format a signal into a rich Telegram message. */
export function formatSignalMessage(signal: Signal): string {
  const icon = ICON[signal.action];
  const dev = signal.deviationPct > 0 ? `+${signal.deviationPct}` : `${signal.deviationPct}`;
  const lines = [
    `${icon} <b>TSLA ${signal.action}${signal.tierLabel ? ` — ${signal.tierLabel}` : ""}</b>`,
    ``,
    `Price: <b>$${signal.price.toFixed(2)}</b>`,
    `Deviation: <b>${dev}%</b> vs baseline $${signal.baselinePrice.toFixed(2)}`,
  ];

  if (signal.action === "BUY") {
    lines.push(
      ``,
      `Deploy: <b>$${signal.amountUsd.toFixed(0)}</b>`,
      `≈ <b>${signal.shares}</b> shares (incl. ~$${signal.feeUsd.toFixed(2)} fee)`,
    );
  } else if (signal.action === "SELL") {
    lines.push(
      ``,
      `Sell: <b>${signal.shares}</b> share${signal.shares === 1 ? "" : "s"}`,
      `Net proceeds: <b>$${signal.amountUsd.toFixed(0)}</b> (after ~$${signal.feeUsd.toFixed(2)} fee)`,
    );
  }

  lines.push(``, `<i>Signal only — review and place the order in CMC.</i>`);
  return lines.join("\n");
}

function signed(n: number, digits = 2): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;
}

/**
 * Daily market open / close summary. Combines the live quote with the current
 * signal so Dad gets a reliable morning and end-of-day snapshot even when no
 * tier has triggered.
 */
export function formatMarketSummary(
  kind: "open" | "close",
  quote: Quote,
  signal: Signal,
): string {
  const isOpen = kind === "open";
  const icon = isOpen ? "🔔" : "🌙";
  const heading = isOpen ? "TSLA — Market Open" : "TSLA — Market Close";
  const headlinePrice = isOpen ? quote.open || quote.price : quote.price;
  const action =
    signal.action === "HOLD"
      ? "No tier triggered — HOLD."
      : `${signal.action}${signal.tierLabel ? ` (${signal.tierLabel})` : ""} signal active.`;

  const lines = [
    `${icon} <b>${heading}</b>`,
    ``,
    `${isOpen ? "Open" : "Close"}: <b>$${headlinePrice.toFixed(2)}</b>`,
    `Change today: <b>${signed(quote.change)}</b> (${signed(quote.changePct)}%)`,
    `Day range: $${quote.low.toFixed(2)} – $${quote.high.toFixed(2)}`,
    `Prev close: $${quote.prevClose.toFixed(2)}`,
    `Baseline: $${signal.baselinePrice.toFixed(2)} (${signed(signal.deviationPct)}% since)`,
    ``,
    `${ICON[signal.action]} ${action}`,
    ``,
    `<i>Signal only — review before trading in CMC.</i>`,
  ];
  return lines.join("\n");
}
