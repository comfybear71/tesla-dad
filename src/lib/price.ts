import type { Quote } from "./types";

/**
 * Fetch a live TSLA quote.
 *
 * Order of preference:
 *   1. Finnhub   (FINNHUB_API_KEY)      — real-time US quotes, generous free tier
 *   2. Alpha Vantage (ALPHAVANTAGE_API_KEY) — fallback, limited free tier
 *   3. Deterministic mock — so the UI/demo always works with no keys set
 */
export async function getQuote(symbol = "TSLA"): Promise<Quote> {
  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (finnhubKey) {
    try {
      return await fromFinnhub(symbol, finnhubKey);
    } catch {
      /* fall through */
    }
  }

  const avKey = process.env.ALPHAVANTAGE_API_KEY;
  if (avKey) {
    try {
      return await fromAlphaVantage(symbol, avKey);
    } catch {
      /* fall through */
    }
  }

  return mockQuote(symbol);
}

async function fromFinnhub(symbol: string, key: string): Promise<Quote> {
  const res = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`finnhub ${res.status}`);
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
  if (!d.c) throw new Error("finnhub empty");
  return {
    symbol,
    price: d.c,
    change: d.d,
    changePct: d.dp,
    high: d.h,
    low: d.l,
    open: d.o,
    prevClose: d.pc,
    source: "finnhub",
    ts: new Date().toISOString(),
  };
}

async function fromAlphaVantage(symbol: string, key: string): Promise<Quote> {
  const res = await fetch(
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(
      symbol,
    )}&apikey=${key}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`alphavantage ${res.status}`);
  const json = (await res.json()) as { "Global Quote"?: Record<string, string> };
  const q = json["Global Quote"];
  if (!q || !q["05. price"]) throw new Error("alphavantage empty");
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

/**
 * Deterministic-ish mock so the app is fully usable without API keys.
 * Oscillates gently around a base price using the current time as a seed.
 */
function mockQuote(symbol: string): Quote {
  const base = 340;
  const t = Date.now() / 1000;
  const wave = Math.sin(t / 1800) * 12 + Math.sin(t / 240) * 4; // slow + fast oscillation
  const price = +(base + wave).toFixed(2);
  const prevClose = base;
  const change = +(price - prevClose).toFixed(2);
  return {
    symbol,
    price,
    change,
    changePct: +((change / prevClose) * 100).toFixed(2),
    high: +(price + 6).toFixed(2),
    low: +(price - 6).toFixed(2),
    open: prevClose,
    prevClose,
    source: "mock",
    ts: new Date().toISOString(),
  };
}
