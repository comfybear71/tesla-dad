"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PriceChart } from "@/components/PriceChart";
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
  const [snapshots, setSnapshots] = useState<PriceSnapshot[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);

  const [action, setAction] = useState<"BUY" | "SELL">((params.get("action") as "BUY" | "SELL") || "BUY");
  const [price, setPrice] = useState(params.get("price") ?? "");
  const [shares, setShares] = useState(params.get("shares") ?? "");
  const [tier] = useState(params.get("tier") ?? "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/history", { cache: "no-store" });
    const json = (await res.json()) as { snapshots: PriceSnapshot[]; trades: Trade[] };
    setSnapshots(json.snapshots);
    setTrades(json.trades);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!price || !shares) return;
    setSaving(true);
    try {
      await fetch("/api/trades", {
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

  return (
    <main className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Trade log</h1>
        <span className="text-xs text-white/40">{trades.length} trades</span>
      </header>

      <section className="card">
        <p className="label mb-3">Price & trades</p>
        <PriceChart snapshots={snapshots} trades={trades} />
      </section>

      {/* Log a trade */}
      <section className="card">
        <p className="label mb-3">Log a trade</p>
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

      {/* Trade table */}
      <section className="card overflow-hidden p-0">
        <p className="label p-5 pb-3">History</p>
        {trades.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-white/40">No trades logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-white/10 text-left text-[11px] uppercase tracking-wider text-white/40">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Side</th>
                  <th className="px-4 py-2 text-right font-medium">Price</th>
                  <th className="px-4 py-2 text-right font-medium">Shares</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                  <th className="px-4 py-2 text-right font-medium">Held</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id} className="border-b border-white/5">
                    <td className="px-4 py-3 text-white/60">{shortDateTime(t.ts)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${t.action === "BUY" ? "bg-signal-buy/15 text-signal-buy" : "bg-tesla-red/15 text-tesla-red"}`}>
                        {t.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{usd(t.price)}</td>
                    <td className="px-4 py-3 text-right">{t.shares}</td>
                    <td className="px-4 py-3 text-right">{usd(t.amountUsd, 0)}</td>
                    <td className="px-4 py-3 text-right text-white/60">{t.sharesAfter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {totalShares != null && (
        <p className="text-center text-xs text-white/40">
          Now holding <span className="font-semibold text-white">{totalShares}</span> TSLA shares ·{" "}
          {trades.filter((t) => t.action === "BUY").length} buys / {trades.filter((t) => t.action === "SELL").length} sells
        </p>
      )}
    </main>
  );
}
