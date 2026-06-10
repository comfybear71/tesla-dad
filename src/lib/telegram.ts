import type { Signal, Quote } from "./types";

/**
 * Send a message via the Telegram Bot API.
 *
 * Setup (one-time):
 *   1. In Telegram, message @BotFather, send /newbot, follow the prompts.
 *   2. Copy the bot token into TELEGRAM_BOT_TOKEN.
 *   3. Start a chat with your new bot and send it any message. (Each extra
 *      recipient — e.g. Dad — must also open the bot and tap Start once;
 *      bots cannot message someone first.)
 *   4. Visit https://api.telegram.org/bot<TOKEN>/getUpdates to find each chat
 *      id, and put them in TELEGRAM_CHAT_ID — comma-separated for multiple
 *      recipients (e.g. "12345678,87654321"). A group chat id (negative
 *      number) works too: add the bot to a family group and everyone sees
 *      the alerts.
 *
 * Returns true if at least one recipient got the message, false if not
 * configured or every send failed.
 */
export async function sendTelegram(text: string): Promise<boolean> {
  const chatIds = telegramChatIds();
  if (chatIds.length === 0) return false;
  const results = await Promise.all(chatIds.map((chatId) => sendTelegramTo(chatId, text)));
  return results.some(Boolean);
}

/** Send to a single chat (used by the webhook to reply to whoever messaged). */
export async function sendTelegramTo(chatId: string | number, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
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

/** The configured recipient list (comma-separated TELEGRAM_CHAT_ID). */
export function telegramChatIds(): string[] {
  return (process.env.TELEGRAM_CHAT_ID ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

const ICON: Record<Signal["action"], string> = {
  BUY: "🟢",
  SELL: "🔴",
  HOLD: "⚪️",
};

/** Format a signal into a rich Telegram message. */
export function formatSignalMessage(signal: Signal, symbol: string): string {
  const icon = ICON[signal.action];
  const dev = signal.deviationPct > 0 ? `+${signal.deviationPct}` : `${signal.deviationPct}`;
  const lines = [
    `${icon} <b>${symbol} ${signal.action}${signal.tierLabel ? ` — ${signal.tierLabel}` : ""}</b>`,
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
 * Premarket gap alert: a watched stock is trading well away from its previous
 * close before the bell. Sent at most once per symbol per ET day.
 */
export function formatGapAlert(quote: Quote, signal: Signal): string {
  const up = quote.changePct >= 0;
  const lines = [
    `⚡️ <b>${quote.symbol} — Premarket gap ${up ? "UP" : "DOWN"} ${signed(quote.changePct)}%</b>`,
    ``,
    `Trading at <b>$${quote.price.toFixed(2)}</b> vs prev close $${quote.prevClose.toFixed(2)}, before the open.`,
    `Baseline: $${signal.baselinePrice.toFixed(2)} (${signed(signal.deviationPct)}% since)`,
    ``,
    `${ICON[signal.action]} ${
      signal.action === "HOLD"
        ? "No tier triggered yet — watch the open."
        : `${signal.action}${signal.tierLabel ? ` (${signal.tierLabel})` : ""} signal active.`
    }`,
    ``,
    `<i>Signal only — review before trading in CMC.</i>`,
  ];
  return lines.join("\n");
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
  const heading = `${quote.symbol} — ${isOpen ? "Market Open" : "Market Close"}`;
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
