"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { TeslaMark } from "@/components/TeslaMark";
import { SignalCard } from "@/components/SignalCard";
import { TierLadder } from "@/components/TierLadder";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { usd, pct } from "@/lib/format";
import type { Config, Quote, Signal } from "@/lib/types";

interface SignalResponse {
  signal: Signal;
  quote: Quote;
  config: Config;
}

export default function HomePage() {
  const [data, setData] = useState<SignalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/signal", { cache: "no-store" });
      const json = (await res.json()) as SignalResponse;
      setData(json);
      setUpdatedAt(new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
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
          <span className={`h-1.5 w-1.5 rounded-full ${data?.quote.source === "mock" ? "bg-amber-400" : "bg-signal-buy"} animate-pulseSoft`} />
          {data ? (data.quote.source === "mock" ? "demo data" : "live") : "…"}
        </div>
      </header>

      {/* Price hero */}
      <section className="card flex flex-col items-center py-8 text-center">
        <p className="label mb-3">TSLA · NASDAQ</p>
        {loading || !data ? (
          <div className="h-12 w-40 animate-pulse rounded bg-white/10" />
        ) : (
          <>
            <div className="text-6xl font-semibold tracking-tight">{usd(data.quote.price)}</div>
            <div className={`mt-2 text-base font-medium ${up ? "text-signal-buy" : "text-tesla-red"}`}>
              {up ? "▲" : "▼"} {usd(Math.abs(data.quote.change))} ({pct(data.quote.changePct)}) today
            </div>
            <div className="mt-4 text-xs text-white/40">
              Baseline {usd(data.config.baselinePrice || data.quote.price)} ·{" "}
              <span className={data.signal.deviationPct >= 0 ? "text-signal-buy/80" : "text-tesla-red/80"}>
                {pct(data.signal.deviationPct)} since
              </span>
            </div>
            {updatedAt && <div className="mt-1 text-[10px] uppercase tracking-widest text-white/25">Updated {updatedAt}</div>}
          </>
        )}
      </section>

      {data && <SignalCard signal={data.signal} />}

      {data && <TierLadder config={data.config} deviationPct={data.signal.deviationPct} />}

      {data && <PortfolioSummary config={data.config} price={data.quote.price} />}

      <Link href="/trades" className="btn-ghost w-full">
        View trade log & chart →
      </Link>
    </main>
  );
}
