import { NextResponse } from "next/server";
import { sendTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/** Quick way to confirm Telegram is wired up: POST to send a test message. */
export async function POST() {
  const ok = await sendTelegram(
    "✅ <b>Tesla Dad</b> is connected. You'll get BUY/SELL signals here.",
  );
  return NextResponse.json({
    sent: ok,
    hint: ok
      ? "Check your Telegram."
      : "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars, then redeploy.",
  });
}
