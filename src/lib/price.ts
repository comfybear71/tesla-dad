import type { Quote } from "./types";

/**
 * Fetch a live TSLA quote from a real market-data provider.
 *
 * Order of preference:
 *   1. Finnhub        (FINNHUB_API_KEY)      — real-time US quotes, free tier
 *   2. Alpha Vantage  (ALPHAVANTAGE_API_KEY) — fallback
 *
 * There is intentionally NO mock/demo fallback: if no provider is configured
 * (or both fail) this throws, and the UI shows an honest "no data" state rather
 * than fabricated numbers. Real data only.
 */
export class NoPriceSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoPriceSourceError";
  }
}

export async function getQuote(symbol = "TSLA"): Promise<Quote> {
  const finnhubKey = process.env.FINNHUB_API_KEY;
  const avKey = process.env.ALPHAVANTAGE_API_KEY;

  if (!finnhubKey && !avKey) {
    throw new NoPriceSourceError(
      "No price source configured. Set FINNHUB_API_KEY (or ALPHAVANTAGE_API_KEY) in your environment.",
    );
  }

  const errors: string[] = [];

  if (finnhubKey) {
    try {
      return await fromFinnhub(symbol, finnhubKey);
    } catch (e) {
      errors.push(`finnhub: ${(e as Error).message}`);
    }
  }

  if (avKey) {
    try {
      return await fromAlphaVantage(symbol, avKey);
    } catch (e) {
      errors.push(`alphavantage: ${(e as Error).message}`);
    }
  }

  throw new NoPriceSourceError(`All price sources failed (${errors.join("; ")}).`);
}

async function fromFinnhub(symbol: string, key: string): Promise<Quote> {
  const res = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`http ${res.status}`);
  // c=current, d=change, dp=change%, h=high, l=low, o=open, pc=prevClose
  const d = (await res.json()) as {
    c: number;
    d: number;
    dp: number;
    h: number;
    l: number;
    o: number;
    pc: number;
  };
  if (!d.c) throw new Error("empty quote");
  // A freshly-listed ticker (e.g. an IPO's first session) can return null for
  // change/changePct/prevClose because there's no prior close yet. Coerce to
  // safe numbers so the UI never receives a null where it expects a number —
  // we derive change from prevClose when we can, otherwise report 0 (flat),
  // which is honest: there is no prior close to measure against.
  const price = d.c;
  const prevClose = num(d.pc);
  const change = num(d.d, prevClose > 0 ? price - prevClose : 0);
  const changePct = num(d.dp, prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0);
  return {
    symbol,
    price,
    change,
    changePct,
    high: num(d.h, price),
    low: num(d.l, price),
    open: num(d.o, price),
    prevClose,
    source: "finnhub",
    ts: new Date().toISOString(),
  };
}

/** Coerce a possibly-null/NaN feed value to a finite number (fallback default). */
function num(v: number | null | undefined, fallback = 0): number {
  return Number.isFinite(v) ? (v as number) : fallback;
}

async function fromAlphaVantage(symbol: string, key: string): Promise<Quote> {
  const res = await fetch(
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(
      symbol,
    )}&apikey=${key}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`http ${res.status}`);
  const json = (await res.json()) as { "Global Quote"?: Record<string, string> };
  const q = json["Global Quote"];
  if (!q || !q["05. price"]) throw new Error("empty quote (rate limit?)");
  const price = parseFloat(q["05. price"]);
  const prevClose = parseFloat(q["08. previous close"]);
  const open = parseFloat(q["02. open"]);
  return {
    symbol,
    price,
    change: parseFloat(q["09. change"] ?? "0"),
    changePct: parseFloat((q["10. change percent"] ?? "0").replace("%", "")),
    high: parseFloat(q["03. high"] ?? String(price)),
    low: parseFloat(q["04. low"] ?? String(price)),
    open: Number.isFinite(open) ? open : price,
    prevClose: Number.isFinite(prevClose) ? prevClose : price,
    source: "alphavantage",
    ts: new Date().toISOString(),
  };
}
