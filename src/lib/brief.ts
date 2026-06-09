import Anthropic from "@anthropic-ai/sdk";
import { getWatchlist, getConfig } from "./store";
import { getQuote } from "./price";
import { computeSignal } from "./signals";
import { getCompanyNews } from "./news";
import { nyTime } from "./market";
import type { DailyBrief, AssetBrief } from "./types";

/**
 * AI daily brief, modelled on budju's "Desk daily brief": gather real market
 * data + real headlines for every watched symbol, have Claude synthesise a
 * short plain-English read, store it, and surface it in the app + Telegram.
 *
 * Strictly context-only: the brief never instructs trades — the tier ladder
 * remains the only signal source. Requires ANTHROPIC_API_KEY; without it the
 * app shows an honest "no brief" state.
 */

const BRIEF_MODEL = process.env.BRIEF_MODEL || "claude-opus-4-8";

const SYSTEM = `You are the research desk for "Tesla Dad", a signal-only stock tracker used by an 80-year-old long-term investor who accumulates shares over years (no day trading, no leverage).

Rules:
- Write in plain, friendly English. No jargon, no hype.
- Be honest and sober: if news is thin, signals are mixed, or nothing happened, say exactly that and keep it short.
- NEVER tell the reader to place, time, or size a trade. The app's tier ladder produces the buy/sell signals; you provide context only.
- Base every statement ONLY on the data provided in the user message. Never invent prices, events, or news.
- "watchFor" is one concrete thing to keep an eye on (an upcoming event, a price area, a specific risk).
- This is not financial advice; do not include a disclaimer, the app shows one.`;

const BRIEF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["marketSummary", "assets"],
  properties: {
    marketSummary: {
      type: "string",
      description: "2-3 sentence plain-English overview across the whole watchlist.",
    },
    assets: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["symbol", "sentiment", "summary", "watchFor"],
        properties: {
          symbol: { type: "string" },
          sentiment: { type: "string", enum: ["bullish", "bearish", "neutral", "mixed"] },
          summary: { type: "string", description: "2-3 sentences on this asset today." },
          watchFor: { type: "string", description: "One concrete thing to watch." },
        },
      },
    },
  },
} as const;

interface AssetInput {
  symbol: string;
  price: number;
  changePctToday: number;
  deviationPctVsBaseline: number;
  currentSignal: string;
  sharesHeld: number;
  recentHeadlines: { headline: string; source: string; publishedAt: string }[];
}

interface BriefOutput {
  marketSummary: string;
  assets: AssetBrief[];
}

export async function generateDailyBrief(): Promise<DailyBrief> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set — add it in Vercel to enable the AI daily brief.");
  }

  const symbols = await getWatchlist();
  const inputs: AssetInput[] = [];

  for (const symbol of symbols) {
    const config = await getConfig(symbol);
    try {
      const quote = await getQuote(symbol);
      const signal = computeSignal(config, quote.price);
      let headlines: AssetInput["recentHeadlines"] = [];
      try {
        const news = await getCompanyNews(symbol, 5, 8);
        headlines = news.map((n) => ({
          headline: n.headline,
          source: n.source,
          publishedAt: n.datetime,
        }));
      } catch {
        // The brief still works without headlines; it will say news is thin.
      }
      inputs.push({
        symbol,
        price: quote.price,
        changePctToday: quote.changePct,
        deviationPctVsBaseline: signal.deviationPct,
        currentSignal:
          signal.action === "HOLD" ? "HOLD (no tier triggered)" : `${signal.action} ${signal.tierLabel ?? ""}`.trim(),
        sharesHeld: config.sharesHeld,
        recentHeadlines: headlines,
      });
    } catch {
      // No real data for this symbol right now — leave it out rather than fake it.
    }
  }

  if (inputs.length === 0) {
    throw new Error("No live market data available for any watched symbol — brief not generated.");
  }

  const client = new Anthropic();
  const response = await client.messages.create({
    model: BRIEF_MODEL,
    max_tokens: 2000,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Today's data (real, fetched just now):\n${JSON.stringify(inputs, null, 2)}\n\nWrite today's brief.`,
      },
    ],
    output_config: { format: { type: "json_schema", schema: BRIEF_SCHEMA } },
  });

  const text = response.content.find(
    (b): b is Extract<(typeof response.content)[number], { type: "text" }> => b.type === "text",
  )?.text;
  if (!text) throw new Error("Brief generation returned no text.");
  const parsed = JSON.parse(text) as BriefOutput;

  return {
    date: nyTime().dateStr,
    generatedAt: new Date().toISOString(),
    model: BRIEF_MODEL,
    marketSummary: parsed.marketSummary,
    assets: parsed.assets,
  };
}

const SENTIMENT_ICON: Record<AssetBrief["sentiment"], string> = {
  bullish: "🟢",
  bearish: "🔴",
  neutral: "⚪️",
  mixed: "🟡",
};

/** Compact Telegram rendering of the daily brief. */
export function formatBriefTelegram(brief: DailyBrief): string {
  const lines = [`🧠 <b>Daily brief</b> — ${brief.date}`, ``, brief.marketSummary, ``];
  for (const a of brief.assets) {
    lines.push(`${SENTIMENT_ICON[a.sentiment]} <b>${a.symbol}</b> (${a.sentiment})`);
    lines.push(a.summary);
    lines.push(`<i>Watch: ${a.watchFor}</i>`, ``);
  }
  lines.push(`<i>Context only — signals still come from the tier ladder.</i>`);
  return lines.join("\n");
}
