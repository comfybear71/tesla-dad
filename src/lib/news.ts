import type { NewsItem } from "./types";

/**
 * Real company news from Finnhub (same API key as quotes). There is no mock
 * fallback: with no key or a failed fetch this throws, and the UI shows an
 * honest "no news source" state.
 */
export class NoNewsSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoNewsSourceError";
  }
}

interface FinnhubNews {
  id: number;
  datetime: number; // unix seconds
  headline: string;
  source: string;
  summary: string;
  url: string;
}

export async function getCompanyNews(symbol: string, days = 7, limit = 25): Promise<NewsItem[]> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    throw new NoNewsSourceError(
      "No news source configured. Set FINNHUB_API_KEY in your environment.",
    );
  }

  const day = (d: Date) => d.toISOString().slice(0, 10);
  const to = new Date();
  const from = new Date(Date.now() - days * 86_400_000);

  const res = await fetch(
    `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${day(from)}&to=${day(to)}&token=${key}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new NoNewsSourceError(`News fetch failed (http ${res.status}).`);

  const raw = (await res.json()) as FinnhubNews[];
  if (!Array.isArray(raw)) throw new NoNewsSourceError("News fetch returned an unexpected shape.");

  // Newest first, de-duped by headline.
  raw.sort((a, b) => b.datetime - a.datetime);
  const seen = new Set<string>();
  const items: NewsItem[] = [];
  for (const n of raw) {
    if (!n.headline || !n.url) continue;
    const dedupeKey = n.headline.trim().toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    items.push({
      id: String(n.id),
      headline: n.headline.trim(),
      source: n.source,
      url: n.url,
      summary: n.summary ?? "",
      datetime: new Date(n.datetime * 1000).toISOString(),
    });
    if (items.length >= limit) break;
  }
  return items;
}
