"use client";

import { useCallback, useEffect, useState } from "react";
import { SymbolTabs } from "@/components/SymbolTabs";
import { useWatchlist } from "@/lib/useWatchlist";
import { timeAgo } from "@/lib/format";
import type { DailyBrief, NewsItem, AssetBrief, MarketContext } from "@/lib/types";

const SENTIMENT_STYLE: Record<AssetBrief["sentiment"], string> = {
  bullish: "bg-signal-buy/15 text-signal-buy",
  bearish: "bg-tesla-red/15 text-tesla-red",
  neutral: "bg-white/10 text-white/60",
  mixed: "bg-amber-400/15 text-amber-300",
};

const REGIME_STYLE: Record<MarketContext["regime"], string> = {
  "risk-on": "bg-signal-buy/15 text-signal-buy",
  "risk-off": "bg-tesla-red/15 text-tesla-red",
  neutral: "bg-white/10 text-white/60",
  mixed: "bg-amber-400/15 text-amber-300",
};

export default function NewsPage() {
  const { symbol, symbols, setSymbol } = useWatchlist();

  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [briefHint, setBriefHint] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [newsErr, setNewsErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/brief", { cache: "no-store" });
        const json = (await res.json()) as DailyBrief & { error?: string; hint?: string };
        if (res.ok) setBrief(json);
        else setBriefHint(json.hint ?? json.error ?? "");
      } catch {
        setBriefHint("Could not reach the server.");
      }
    })();
  }, []);

  const loadNews = useCallback(async () => {
    if (!symbol) return;
    setNews(null);
    setNewsErr("");
    try {
      const res = await fetch(`/api/news?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" });
      const json = (await res.json()) as { items?: NewsItem[]; error?: string };
      if (res.ok && json.items) setNews(json.items);
      else setNewsErr(json.error ?? "News unavailable.");
    } catch {
      setNewsErr("Could not reach the server.");
    }
  }, [symbol]);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  async function refreshBrief() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/brief", { method: "POST" });
      const json = (await res.json()) as DailyBrief & { error?: string };
      if (res.ok) {
        setBrief(json);
        setBriefHint("");
      } else {
        setBriefHint(json.error ?? "Could not generate the brief.");
      }
    } catch {
      setBriefHint("Could not reach the server.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <main className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Market desk</h1>
        {brief && <span className="text-xs text-white/40">brief · {brief.date}</span>}
      </header>

      {/* AI daily brief */}
      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <p className="label">AI daily brief</p>
          <button
            type="button"
            onClick={refreshBrief}
            disabled={refreshing}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/60 transition hover:bg-white/10 disabled:opacity-50"
          >
            {refreshing ? "Thinking…" : brief ? "Refresh" : "Generate now"}
          </button>
        </div>

        {brief ? (
          <>
            {brief.marketContext && (
              <div className="mb-4 rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="label">Market</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${REGIME_STYLE[brief.marketContext.regime]}`}
                  >
                    {brief.marketContext.regime}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-white/70">{brief.marketContext.summary}</p>
              </div>
            )}
            <p className="text-sm leading-relaxed text-white/85">{brief.marketSummary}</p>
            <div className="mt-4 flex flex-col gap-3">
              {brief.assets.map((a) => (
                <div key={a.symbol} className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-sm font-semibold tracking-wide">{a.symbol}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${SENTIMENT_STYLE[a.sentiment]}`}>
                      {a.sentiment}
                      {a.confidence != null && ` · ${a.confidence}%`}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-white/70">{a.summary}</p>
                  <p className="mt-2 text-xs leading-relaxed text-white/45">
                    <span className="font-semibold text-white/60">Watch:</span> {a.watchFor}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-white/30">
              Generated {timeAgo(brief.generatedAt)} from live quotes and real headlines. Context
              only — not financial advice, and signals still come from the tier ladder.
            </p>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-white/50">
            {briefHint ||
              "No brief yet. A fresh one is generated each market morning and lands here (and on Telegram)."}
          </p>
        )}
      </section>

      {/* Headlines */}
      <SymbolTabs symbols={symbols} active={symbol} onSelect={setSymbol} />

      <section className="card overflow-hidden p-0">
        <p className="label p-5 pb-3">Latest {symbol || ""} headlines</p>
        {newsErr ? (
          <p className="px-5 pb-6 text-sm leading-relaxed text-white/50">
            {newsErr} This app never shows made-up headlines — the feed stays empty until real news
            is available.
          </p>
        ) : news == null ? (
          <div className="flex flex-col gap-3 px-5 pb-6">
            <div className="h-10 animate-pulse rounded bg-white/5" />
            <div className="h-10 animate-pulse rounded bg-white/5" />
            <div className="h-10 animate-pulse rounded bg-white/5" />
          </div>
        ) : news.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-white/40">No recent news found for {symbol}.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {news.map((n) => (
              <li key={n.id}>
                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-5 py-3.5 transition hover:bg-white/5"
                >
                  <p className="text-sm font-medium leading-snug text-white/85">{n.headline}</p>
                  <p className="mt-1 text-[11px] text-white/40">
                    {n.source} · {timeAgo(n.datetime)}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
