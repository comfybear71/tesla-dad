import { NextResponse } from "next/server";
import { addDeskNote } from "@/lib/store";
import { sendTelegramTo, telegramChatIds } from "@/lib/telegram";
import { transcribeTelegramVoice } from "@/lib/transcribe";
import type { DeskNote } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // voice download + Whisper transcription

/**
 * Telegram webhook: lets the bot LISTEN as well as talk. Voice memos are
 * transcribed with Whisper and text sent as "/note ..." is captured directly;
 * both are stored as desk notes and folded into the next AI daily brief as
 * the owner's own context (never trade instructions).
 *
 * One-time setup (owner): register the webhook with
 *   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://tesla-dad.vercel.app/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
 * Note: while a webhook is set, the manual getUpdates URL no longer works —
 * that's normal Telegram behavior.
 *
 * Only chats listed in TELEGRAM_CHAT_ID are accepted; everything else is
 * acknowledged and ignored.
 */

interface TelegramUpdate {
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string };
    chat: { id: number };
    text?: string;
    voice?: { file_id: string; duration: number };
  };
}

export async function POST(req: Request) {
  // Verify the webhook secret when configured (Telegram echoes it back on
  // every delivery). Without it, anyone who finds the URL could inject notes.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as TelegramUpdate | null;
  const msg = update?.message;
  // Always 200 on ignored updates so Telegram doesn't retry them forever.
  if (!msg) return NextResponse.json({ ok: true });

  const chatId = msg.chat.id;
  if (!telegramChatIds().includes(String(chatId))) {
    return NextResponse.json({ ok: true, ignored: "unknown chat" });
  }

  const from = msg.from?.first_name ?? "Owner";

  if (msg.voice) {
    const text = await transcribeTelegramVoice(msg.voice.file_id);
    if (!text) {
      await sendTelegramTo(
        chatId,
        "🎙 Couldn't transcribe that — check that GROQ_API_KEY (or OPENAI_API_KEY) is set, then try again.",
      );
      return NextResponse.json({ ok: true, saved: false });
    }
    await saveNote(chatId, from, "voice", text);
    return NextResponse.json({ ok: true, saved: true });
  }

  const text = msg.text?.trim();
  if (text?.startsWith("/note")) {
    const body = text.slice(5).trim();
    if (!body) {
      await sendTelegramTo(chatId, "✏️ Usage: <b>/note your observation here</b> — or just send a voice memo.");
      return NextResponse.json({ ok: true, saved: false });
    }
    await saveNote(chatId, from, "text", body);
    return NextResponse.json({ ok: true, saved: true });
  }

  if (text === "/start" || text === "/help") {
    await sendTelegramTo(
      chatId,
      "👋 I send the signals — and I listen too.\n\nSend a <b>voice memo</b> or <b>/note your thought</b> and it goes into the next morning's AI brief as your own context.\n\n<i>Notes never place trades — the tier ladder stays in charge of signals.</i>",
    );
  }

  return NextResponse.json({ ok: true });
}

async function saveNote(
  chatId: number,
  from: string,
  kind: DeskNote["kind"],
  text: string,
): Promise<void> {
  await addDeskNote({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    from,
    kind,
    text,
  });
  await sendTelegramTo(
    chatId,
    `🗒 Saved to your desk${kind === "voice" ? ` — heard:\n"<i>${escapeHtml(text)}</i>"` : "."}\nIt'll be woven into the next morning brief.`,
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
