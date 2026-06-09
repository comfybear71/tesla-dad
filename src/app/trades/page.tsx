"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PriceChart } from "@/components/PriceChart";
import { SymbolTabs } from "@/components/SymbolTabs";
import { useWatchlist } from "@/lib/useWatchlist";
import { usd, shortDateTime } from "@/lib/format";
import type { PriceSnapshot, Trade } from "@/lib/types";

export default function TradesPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-white/40">Loading…</div>}>
      <TradesInner />
    </Suspense>
  );
}

function TradesInner() {
  const params = useSearchParams();
  const { symbol, symbols, setSymbol } = useWatchlist(params.get("symbol"));
  const [snapshots, setSnapshots] = useState<PriceSnapshot[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [baselinePrice, setBaselinePrice] = useState(0);

  const [action, setAction] = useState<"BUY" | "SELL">((params.get("action") as "BUY" | "SELL") || "BUY");
  const [price, setPrice] = useState(params.get("price") ?? "");
  const [shares, setShares] = useState(params.get("shares") ?? "");
  const [tier] = useState(params.get("tier") ?? "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!symbol) return;
    const res = await fetch(`/api/history?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" });
    const json = (await res.json()) as {
      snapshots: PriceSnapshot[];
      trades: Trade[];
      baselinePrice: number;
    };
    setSnapshots(json.snapshots);
    setTrades(json.trades);
    setBaselinePrice(json.baselinePrice);
  }, [symbol]);

  useEffect(() => {
    setSnapshots([]);
    setTrades([]);
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!price || !shares || !symbol) return;
    setSaving(true);
    try {
      await fetch(`/api/trades?symbol=${encodeURIComponent(symbol)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          price: parseFloat(price),
          shares: parseFloat(shares),
          tierLabel: tier || null,
          note: note || undefined,
        }),
      });
      setShares("");
      setNote("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  const totalShares = trades[0]?.sharesAfter;
  const buys = trades.filter((t) => t.action === "BUY").length;
  const sells = trades.length - buys;

  return (
    <main className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Trade log</h1>
        <span className="text-xs text-white/40">
          {trades.length} trade{trades.length === 1 ? "" : "s"}
        </span>
      </header>

      <SymbolTabs symbols={symbols} active={symbol} onSelect={setSymbol} />

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <p className="label">Price & trades</p>
          <div className="flex items-center gap-3 text-[10px] text-white/40">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-signal-buy" /> buy
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-tesla-red" /> sell
            </span>
          </div>
        </div>
        <PriceChart snapshots={snapshots} trades={trades} baselinePrice={baselinePrice} />
      </section>

      {/* Log a trade */}
      <section className="card">
        <p className="label mb-3">Log a trade · {symbol || "…"}</p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAction("BUY")}
              className={`btn ${action === "BUY" ? "bg-signal-buy text-ink" : "border border-white/15 bg-white/5 text-white/70"}`}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => setAction("SELL")}
              className={`btn ${action === "SELL" ? "bg-tesla-red text-white" : "border border-white/15 bg-white/5 text-white/70"}`}
            >
              Sell
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="label">Price (USD)</span>
              <input className="input" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" required />
            </label>
            <label className="flex flex-col gap-1">
              <span className="label">Shares</span>
              <input className="input" type="number" step="0.0001" value={shares} onChange={(e) => setShares(e.target.value)} placeholder="0" required />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="label">Note {tier && `· ${tier}`}</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
          </label>
          <button type="submit" disabled={saving} className="btn-primary w-full disabled:opacity-50">
            {saving ? "Saving…" : `Record ${action}`}
          </button>
        </form>
      </section>

      {/* Trade history */}
      <section className="card overflow-hidden p-0">
        <p className="label p-5 pb-3">History</p>
        {trades.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-white/40">
            No trades logged for {symbol || "this symbol"} yet.
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {trades.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      t.action === "BUY" ? "bg-signal-buy/15 text-signal-buy" : "bg-tesla-red/15 text-tesla-red"
                    }`}
                  >
                    {t.action}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium tabular-nums">
                      {t.shares} sh @ {usd(t.price)}
                    </p>
                    <p className="truncate text-[11px] text-white/40">
                      {shortDateTime(t.ts)}
                      {t.tierLabel ? ` · ${t.tierLabel}` : ""}
                      {t.note ? ` · ${t.note}` : ""}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums">{usd(t.amountUsd, 0)}</p>
                  <p className="text-[11px] tabular-nums text-white/40">held {t.sharesAfter}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {totalShares != null && (
        <p className="text-center text-xs text-white/40">
          Now holding <span className="font-semibold text-white">{totalShares}</span> {symbol} shares ·{" "}
          {buys} buy{buys === 1 ? "" : "s"} / {sells} sell{sells === 1 ? "" : "s"}
        </p>
      )}
    </main>
  );
}
