/**
 * Transcribe a Telegram voice note with Whisper — Groq's hosted
 * whisper-large-v3-turbo first (GROQ_API_KEY), OpenAI's whisper-1 as
 * fallback (OPENAI_API_KEY). Same proven approach as budju's desk capture.
 * Returns null (never fabricated text) when no key is set or the call fails.
 */
export async function transcribeTelegramVoice(fileId: string): Promise<string | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return null;

  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!groqKey && !openaiKey) return null;

  try {
    // Resolve the Telegram file path, then download the OGG audio.
    const fileRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`,
      { cache: "no-store" },
    );
    const filePath = ((await fileRes.json()) as { result?: { file_path?: string } }).result
      ?.file_path;
    if (!filePath) return null;

    const audioRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
    if (!audioRes.ok) return null;
    const audio = await audioRes.arrayBuffer();

    const useGroq = Boolean(groqKey);
    const endpoint = useGroq
      ? "https://api.groq.com/openai/v1/audio/transcriptions"
      : "https://api.openai.com/v1/audio/transcriptions";
    const model = useGroq ? "whisper-large-v3-turbo" : "whisper-1";
    const key = useGroq ? groqKey : openaiKey;

    const form = new FormData();
    form.append("file", new Blob([audio], { type: "audio/ogg" }), "voice.ogg");
    form.append("model", model);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) {
      console.error("transcription failed:", res.status, await res.text());
      return null;
    }
    const text = ((await res.json()) as { text?: string }).text?.trim();
    return text || null;
  } catch (e) {
    console.error("transcribeTelegramVoice error:", (e as Error).message);
    return null;
  }
}
