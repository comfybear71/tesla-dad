import Anthropic from "@anthropic-ai/sdk";
import { getWatchlist, getConfig, getDeskNotes, getSnapshots } from "./store";
import { getQuote } from "./price";
import { computeSignal } from "./signals";
import { getCompanyNews } from "./news";
import { nyTime, MARKET_OPEN_MIN } from "./market";
import type { DailyBrief, AssetBrief, MarketContext } from "./types";

/**
 * AI daily brief, modelled on budju's "Desk daily brief": a broad-market
 * regime read (real SPY/QQQ/oil quotes) on top, then a per-asset analysis
 * with sentiment + confidence, week change (from our stored snapshots),
 * distance to the next ladder triggers, real headlines and the owner's
 * Telegram desk notes. Stored once per ET day, shown on /news and Telegram.
 *
 * Strictly context-only: the brief never instructs trades — the tier ladder
 * remains the only signal source. Requires ANTHROPIC_API_KEY; without it the
 * app shows an honest "no brief" state.
 */

const BRIEF_MODEL = process.env.BRIEF_MODEL || "claude-opus-4-8";

/** Broad-tape proxies the brief reads every morning (all real Finnhub quotes). */
const MARKET_TAPE: { symbol: string; label: string }[] = [
  { symbol: "SPY", label: "S&P 500 ETF" },
  { symbol: "QQQ", label: "Nasdaq-100 ETF" },
  { symbol: "USO", label: "US Oil Fund (crude proxy)" },
];

const SYSTEM = `You are the research desk for "Tesla Dad", a signal-only stock tracker used by an 80-year-old long-term investor who accumulates shares over years (no day trading, no leverage).

Rules:
- Write in plain, friendly English. No jargon, no hype.
- Be honest and sober: if news is thin, signals are mixed, or nothing happened, say exactly that and keep it short.
- NEVER tell the reader to place, time, or size a trade. The app's tier ladder produces the buy/sell signals; you provide context only.
- Base every statement ONLY on the data provided in the user message. Never invent prices, events, or news.
- marketTape gives broad-market proxies (index ETFs, oil). Use them to classify the regime: risk-on / risk-off / neutral / mixed, and explain in 2-3 sentences. Oil moves matter for geopolitical context.
- Per asset, "confidence" (0-100) is how confident you are in your sentiment read. Be conservative: mixed or thin evidence means below 50. It describes conviction in the ANALYSIS, never a trade recommendation.
- nextTriggers shows where the app's own ladder would signal next; you may reference those levels as context ("the first buy rung sits at ..."), but the ladder does the signalling, not you.
- ownerNotes are the family's own recent observations (voice memos / texts). Weigh them as human context — attribute them ("your note about ..."), connect them to the data where relevant, and respectfully disagree if the data doesn't support them. They are NEVER trade instructions.
- "watchFor" is one concrete thing to keep an eye on (an upcoming event, a price area, a specific risk).
- This is not financial advice; do not include a disclaimer, the app shows one.`;

const BRIEF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["marketContext", "marketSummary", "assets"],
  properties: {
    marketContext: {
      type: "object",
      additionalProperties: false,
      required: ["regime", "summary"],
      properties: {
        regime: { type: "string", enum: ["risk-on", "risk-off", "neutral", "mixed"] },
        summary: {
          type: "string",
          description: "2-3 sentences on the broad tape: indexes, oil, macro tone.",
        },
      },
    },
    marketSummary: {
      type: "string",
      description: "2-3 sentence plain-English overview across the watchlist itself.",
    },
    assets: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["symbol", "sentiment", "confidence", "summary", "watchFor"],
        properties: {
          symbol: { type: "string" },
          sentiment: { type: "string", enum: ["bullish", "bearish", "neutral", "mixed"] },
          confidence: {
            type: "integer",
            description: "Conviction in the read, 0-100. Conservative; below 50 when mixed.",
          },
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
  /** Change vs ~7 days ago from stored real snapshots; null when history is too short. */
  changePctWeek: number | null;
  deviationPctVsBaseline: number;
  currentSignal: string;
  nextTriggers: {
    firstBuyAt: number;
    firstBuyDropPct: number;
    firstSellAt: number;
    firstSellRisePct: number;
  } | null;
  sharesHeld: number;
  recentHeadlines: { headline: string; source: string; publishedAt: string }[];
}

interface BriefOutput {
  marketContext: MarketContext;
  marketSummary: string;
  assets: (AssetBrief & { confidence: number })[];
}

export async function generateDailyBrief(): Promise<DailyBrief> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set — add it in Vercel to enable the AI daily brief.");
  }

  // Broad tape first (sequential, kind to the free-tier rate limit).
  const marketTape: { symbol: string; label: string; price: number; changePctToday: number }[] = [];
  for (const t of MARKET_TAPE) {
    try {
      const q = await getQuote(t.symbol);
      marketTape.push({ ...t, price: q.price, changePctToday: q.changePct });
    } catch {
      // Skip a proxy we can't get real data for — never invent it.
    }
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

      const baseline = config.baselinePrice > 0 ? config.baselinePrice : quote.price;
      const shallowBuy = Math.min(...config.tiers.map((t) => t.buyDropPct));
      const shallowSell = Math.min(...config.tiers.map((t) => t.sellRisePct));

      inputs.push({
        symbol,
        price: quote.price,
        changePctToday: quote.changePct,
        changePctWeek: await weekChangePct(symbol, quote.price),
        deviationPctVsBaseline: signal.deviationPct,
        currentSignal:
          signal.action === "HOLD" ? "HOLD (no tier triggered)" : `${signal.action} ${signal.tierLabel ?? ""}`.trim(),
        nextTriggers:
          config.tiers.length > 0
            ? {
                firstBuyAt: +(baseline * (1 - shallowBuy / 100)).toFixed(2),
                firstBuyDropPct: shallowBuy,
                firstSellAt: +(baseline * (1 + shallowSell / 100)).toFixed(2),
                firstSellRisePct: shallowSell,
              }
            : null,
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

  // Owner observations from the last 48h (Telegram voice memos / /note texts).
  const cutoff = Date.now() - 48 * 3_600_000;
  const ownerNotes = (await getDeskNotes())
    .filter((n) => new Date(n.ts).getTime() >= cutoff)
    .slice(0, 10)
    .map((n) => ({ at: n.ts, from: n.from, note: n.text }));

  const ny = nyTime();
  const premarket = ny.minutes < MARKET_OPEN_MIN;
  const client = new Anthropic();
  const response = await client.messages.create({
    model: BRIEF_MODEL,
    max_tokens: 2500,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Today's data (real, fetched just now${
          premarket ? ", PREMARKET — prices/changes are pre-open prints and may be thin" : ""
        }):\n\nmarketTape:\n${JSON.stringify(marketTape, null, 2)}\n\nwatchlist:\n${JSON.stringify(
          inputs,
          null,
          2,
        )}\n\nownerNotes (last 48h, newest first):\n${JSON.stringify(ownerNotes, null, 2)}\n\nWrite today's brief.`,
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
    date: ny.dateStr,
    generatedAt: new Date().toISOString(),
    model: BRIEF_MODEL,
    marketContext: parsed.marketContext,
    marketSummary: parsed.marketSummary,
    assets: parsed.assets,
  };
}

/**
 * Change vs ~one week ago, computed from our own stored (real) snapshots.
 * Returns null when the history doesn't reach back far enough to be honest.
 */
async function weekChangePct(symbol: string, currentPrice: number): Promise<number | null> {
  const snaps = await getSnapshots(symbol);
  if (snaps.length === 0) return null;
  const target = Date.now() - 7 * 86_400_000;
  const old = snaps.find((s) => new Date(s.ts).getTime() >= target);
  if (!old || old.price <= 0) return null;
  // Require at least ~4 days of lookback so a day-old history isn't sold as "the week".
  if (new Date(old.ts).getTime() > Date.now() - 4 * 86_400_000) return null;
  return +(((currentPrice - old.price) / old.price) * 100).toFixed(2);
}

const SENTIMENT_ICON: Record<AssetBrief["sentiment"], string> = {
  bullish: "🟢",
  bearish: "🔴",
  neutral: "⚪️",
  mixed: "🟡",
};

/** Telegram rendering of the daily brief, budju-Desk style. */
export function formatBriefTelegram(brief: DailyBrief): string {
  const lines = [`🌞 <b>Tesla Dad Desk — Daily brief</b> · ${brief.date}`, ``];
  if (brief.marketContext) {
    lines.push(`🌐 <b>Market:</b> ${brief.marketContext.regime}`, brief.marketContext.summary, ``);
  }
  lines.push(brief.marketSummary, ``);
  for (const a of brief.assets) {
    const conf = a.confidence != null ? ` · ${a.confidence}%` : "";
    lines.push(`${SENTIMENT_ICON[a.sentiment]} <b>${a.symbol}</b> — ${a.sentiment}${conf}`);
    lines.push(a.summary);
    lines.push(`<i>Watch: ${a.watchFor}</i>`, ``);
  }
  lines.push(`<i>Context only — signals still come from the tier ladder.</i>`);
  return lines.join("\n");
}
