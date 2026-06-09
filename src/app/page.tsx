"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { TeslaMark } from "@/components/TeslaMark";
import { SignalCard } from "@/components/SignalCard";
import { TierLadder } from "@/components/TierLadder";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { SymbolTabs } from "@/components/SymbolTabs";
import { DayRange } from "@/components/DayRange";
import { useWatchlist } from "@/lib/useWatchlist";
import { usd, pct } from "@/lib/format";
import type { Config, Quote, Signal } from "@/lib/types";

interface SignalResponse {
  signal: Signal;
  quote: Quote;
  config: Config;
}

interface ErrorResponse {
  error: string;
  code?: string;
  config?: Config;
}

export default function HomePage() {
  const { symbol, symbols, setSymbol } = useWatchlist();
  const [data, setData] = useState<SignalResponse | null>(null);
  const [err, setErr] = useState<ErrorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string>("");

  const load = useCallback(async () => {
    if (!symbol) return;
    try {
      const res = await fetch(`/api/signal?symbol=${encodeURIComponent(symbol)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setErr((await res.json()) as ErrorResponse);
        setData(null);
      } else {
        setData((await res.json()) as SignalResponse);
        setErr(null);
        setUpdatedAt(
          new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        );
      }
    } catch {
      setErr({ error: "Could not reach the server." });
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  // Reload (and show the skeleton) whenever the selected symbol changes.
  useEffect(() => {
    setLoading(true);
    setData(null);
    setErr(null);
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const up = (data?.quote.changePct ?? 0) >= 0;

  return (
    <main className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TeslaMark className="h-3.5 w-auto text-tesla-red" />
          <span className="text-sm font-semibold tracking-[0.3em] text-white/80">DAD</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-white/40">
          <span
            className={`h-1.5 w-1.5 rounded-full ${err ? "bg-tesla-red" : data ? "bg-signal-buy animate-pulseSoft" : "bg-white/30"}`}
          />
          {err ? "no feed" : data ? "live" : "…"}
        </div>
      </header>

      <SymbolTabs symbols={symbols} active={symbol} onSelect={setSymbol} />

      {/* No price source / no data for this symbol */}
      {err && (
        <section className="card border-tesla-red/30">
          <p className="label mb-2 text-tesla-red/80">Live price unavailable</p>
          <p className="text-sm leading-relaxed text-white/70">
            No live market data for <span className="font-semibold text-white">{symbol || "this symbol"}</span>{" "}
            right now. If no source is connected yet, add a{" "}
            <span className="font-semibold text-white">FINNHUB_API_KEY</span> (or{" "}
            <span className="font-semibold text-white">ALPHAVANTAGE_API_KEY</span>) in your Vercel
            environment variables and redeploy.
          </p>
          <p className="mt-3 text-xs text-white/40">
            This app never shows fake numbers — it stays blank until real data is available.
          </p>
        </section>
      )}

      {/* Price hero */}
      {!err && (
        <section className="card flex flex-col items-center py-8 text-center">
          <p className="label mb-3">{symbol || "…"} · live</p>
          {loading || !data ? (
            <div className="flex flex-col items-center gap-3">
              <div className="h-14 w-44 animate-pulse rounded-lg bg-white/10" />
              <div className="h-4 w-32 animate-pulse rounded bg-white/5" />
            </div>
          ) : (
            <>
              <div
                key={data.quote.price}
                className="animate-fadeUp text-6xl font-semibold tabular-nums tracking-tight"
              >
                {usd(data.quote.price)}
              </div>
              <div className={`mt-2 text-base font-medium tabular-nums ${up ? "text-signal-buy" : "text-tesla-red"}`}>
                {up ? "▲" : "▼"} {usd(Math.abs(data.quote.change))} ({pct(data.quote.changePct)}) today
              </div>
              <DayRange quote={data.quote} />
              <div className="mt-5 text-xs tabular-nums text-white/40">
                Baseline {usd(data.config.baselinePrice || data.quote.price)} ·{" "}
                <span className={data.signal.deviationPct >= 0 ? "text-signal-buy/80" : "text-tesla-red/80"}>
                  {pct(data.signal.deviationPct)} since
                </span>
              </div>
              {updatedAt && (
                <div className="mt-1 text-[10px] uppercase tracking-widest text-white/25">
                  Updated {updatedAt} · {data.quote.source}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Skeletons while the first load is in flight */}
      {!err && (loading || !data) && (
        <>
          <div className="card h-32 animate-pulse" />
          <div className="card h-80 animate-pulse" />
        </>
      )}

      {data && <SignalCard signal={data.signal} symbol={symbol} />}

      {data && (
        <TierLadder
          config={data.config}
          deviationPct={data.signal.deviationPct}
          baselinePrice={data.config.baselinePrice || data.quote.price}
        />
      )}

      {(data?.config || err?.config) && (
        <PortfolioSummary
          config={(data?.config ?? err?.config)!}
          price={data?.quote.price ?? 0}
          change={data?.quote.change}
        />
      )}

      <Link href={`/trades?symbol=${encodeURIComponent(symbol)}`} className="btn-ghost w-full">
        View trade log & chart →
      </Link>
    </main>
  );
}
