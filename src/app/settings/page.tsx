"use client";

import { useCallback, useEffect, useState } from "react";
import { SymbolTabs } from "@/components/SymbolTabs";
import { useWatchlist } from "@/lib/useWatchlist";
import { usd } from "@/lib/format";
import type { Config, Quote, Tier } from "@/lib/types";

export default function SettingsPage() {
  const { symbol, symbols, setSymbol, reload } = useWatchlist();
  const [config, setConfig] = useState<Config | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [status, setStatus] = useState("");

  const [newSymbol, setNewSymbol] = useState("");
  const [watchlistMsg, setWatchlistMsg] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!symbol) return;
    setConfig(null);
    const qs = `?symbol=${encodeURIComponent(symbol)}`;
    const [c, q] = await Promise.all([
      fetch(`/api/config${qs}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/quote${qs}`, { cache: "no-store" }).then((r) => r.json()),
    ]);
    setConfig(c);
    setQuote(q);
  }, [symbol]);

  useEffect(() => {
    load();
  }, [load]);

  function setField<K extends keyof Config>(key: K, value: Config[K]) {
    setConfig((c) => (c ? { ...c, [key]: value } : c));
  }

  function setTier(i: number, key: keyof Tier, value: number) {
    setConfig((c) => {
      if (!c) return c;
      const tiers = c.tiers.map((t, idx) => (idx === i ? { ...t, [key]: value } : t));
      return { ...c, tiers };
    });
  }

  async function save() {
    if (!config) return;
    setStatus("Saving…");
    const res = await fetch(`/api/config?symbol=${encodeURIComponent(symbol)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (res.ok) setStatus("Saved ✓");
    setTimeout(() => setStatus(""), 2000);
  }

  async function testTelegram() {
    setStatus("Sending test…");
    const res = await fetch("/api/test-telegram", { method: "POST" });
    const json = (await res.json()) as { sent: boolean; hint: string };
    setStatus(json.sent ? "Telegram sent ✓" : json.hint);
    setTimeout(() => setStatus(""), 5000);
  }

  async function addSymbol(e: React.FormEvent) {
    e.preventDefault();
    if (!newSymbol.trim()) return;
    setAdding(true);
    setWatchlistMsg("");
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: newSymbol }),
      });
      const json = (await res.json()) as { symbols?: string[]; error?: string };
      if (!res.ok) {
        setWatchlistMsg(json.error ?? "Could not add symbol.");
      } else {
        const added = newSymbol.trim().toUpperCase();
        setNewSymbol("");
        setWatchlistMsg(`${added} added ✓`);
        await reload();
        setSymbol(added);
        setTimeout(() => setWatchlistMsg(""), 3000);
      }
    } catch {
      setWatchlistMsg("Could not reach the server.");
    } finally {
      setAdding(false);
    }
  }

  async function removeSymbol(s: string) {
    if (!window.confirm(`Stop tracking ${s}? Its settings and trade history are kept and come back if you re-add it.`)) {
      return;
    }
    const res = await fetch(`/api/watchlist?symbol=${encodeURIComponent(s)}`, { method: "DELETE" });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setWatchlistMsg(json.error ?? "Could not remove symbol.");
      return;
    }
    await reload();
  }

  return (
    <main className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        {status && <span className="text-xs text-white/60">{status}</span>}
      </header>

      {/* Watchlist */}
      <section id="watchlist" className="card scroll-mt-6">
        <p className="label mb-1">Watchlist</p>
        <p className="mb-4 text-xs leading-relaxed text-white/40">
          Track more stocks alongside TSLA — NVDA works today; SpaceX, Anthropic and OpenAI can be
          added the day they list. Only real, live-quoted tickers are accepted.
        </p>
        <ul className="mb-4 flex flex-col gap-2">
          {symbols.map((s) => (
            <li
              key={s}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3"
            >
              <span className="text-sm font-semibold tracking-wide">{s}</span>
              {symbols.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSymbol(s)}
                  className="rounded-full px-3 py-1 text-xs font-medium text-white/40 transition hover:bg-tesla-red/15 hover:text-tesla-red"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={addSymbol} className="flex gap-2">
          <input
            className="input flex-1 uppercase"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            placeholder="Ticker, e.g. NVDA"
            maxLength={10}
            autoCapitalize="characters"
            autoCorrect="off"
          />
          <button type="submit" disabled={adding || !newSymbol.trim()} className="btn-primary shrink-0 disabled:opacity-50">
            {adding ? "Checking…" : "Add"}
          </button>
        </form>
        {watchlistMsg && <p className="mt-3 text-xs leading-relaxed text-white/60">{watchlistMsg}</p>}
      </section>

      {/* Per-symbol strategy */}
      <div className="flex items-center justify-between">
        <p className="label">Strategy for</p>
        <span className="text-xs text-white/40">{symbol}</span>
      </div>
      <SymbolTabs symbols={symbols} active={symbol} onSelect={setSymbol} showAdd={false} />

      {!config ? (
        <div className="card h-40 animate-pulse" />
      ) : (
        <>
          {/* Baseline */}
          <section className="card">
            <p className="label mb-3">Baseline</p>
            <p className="mb-3 text-xs text-white/40">
              Deviations are measured from here. It resets automatically after each logged trade.
            </p>
            <NumberField label="Baseline price (USD)" value={config.baselinePrice} onChange={(v) => setField("baselinePrice", v)} step={0.01} />
            {quote && quote.price > 0 && (
              <button
                type="button"
                onClick={() => setField("baselinePrice", quote.price)}
                className="btn-ghost mt-3 w-full text-sm"
              >
                Set to current price ({usd(quote.price)})
              </button>
            )}
          </section>

          {/* Holdings */}
          <section className="card grid grid-cols-1 gap-3">
            <p className="label">Holdings · {symbol}</p>
            <NumberField label={`${symbol} shares`} value={config.sharesHeld} onChange={(v) => setField("sharesHeld", v)} step={1} />
            <NumberField label="USD cash for this stock" value={config.cashUsd} onChange={(v) => setField("cashUsd", v)} step={100} />
          </section>

          {/* Order rules */}
          <section className="card grid grid-cols-1 gap-3">
            <p className="label">Order rules (CMC)</p>
            <NumberField label="Min order (USD)" value={config.minOrderUsd} onChange={(v) => setField("minOrderUsd", v)} step={100} />
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Fee %" value={config.feePct} onChange={(v) => setField("feePct", v)} step={0.01} compact />
              <NumberField label="Flat fee (USD)" value={config.feeFlatUsd} onChange={(v) => setField("feeFlatUsd", v)} step={1} compact />
            </div>
          </section>

          {/* Tiers */}
          <section className="card">
            <p className="label mb-1">Signal tiers</p>
            <p className="mb-4 text-xs text-white/40">Buy deeper dips with more cash; sell into bigger rallies.</p>
            <div className="flex flex-col gap-4">
              {config.tiers.map((t, i) => (
                <div key={t.label} className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <p className="mb-3 text-sm font-semibold">{t.label}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <NumberField label="Buy on drop %" value={t.buyDropPct} onChange={(v) => setTier(i, "buyDropPct", v)} step={0.5} accent="text-signal-buy" compact />
                    <NumberField label="Deploy USD" value={t.buyUsd} onChange={(v) => setTier(i, "buyUsd", v)} step={100} accent="text-signal-buy" compact />
                    <NumberField label="Sell on rise %" value={t.sellRisePct} onChange={(v) => setTier(i, "sellRisePct", v)} step={0.5} accent="text-tesla-red" compact />
                    <NumberField label="Sell shares" value={t.sellShares} onChange={(v) => setTier(i, "sellShares", v)} step={1} accent="text-tesla-red" compact />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <button onClick={save} className="btn-primary w-full">
            Save {symbol} settings
          </button>
        </>
      )}

      <button onClick={testTelegram} className="btn-ghost w-full">Send test Telegram</button>

      <p className="px-2 text-center text-[11px] leading-relaxed text-white/30">
        This is a signal tool only. It never places real orders. Review every alert and trade through CMC yourself.
      </p>
    </main>
  );
}

/** Round to the step's precision so +/- doesn't accumulate float noise. */
function snap(v: number, step: number): number {
  const decimals = (String(step).split(".")[1] ?? "").length;
  return Math.max(0, parseFloat(v.toFixed(decimals)));
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  accent = "text-white",
  compact = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  accent?: string;
  /** Hide the +/- steppers where the grid is too tight for them. */
  compact?: boolean;
}) {
  const safe = Number.isFinite(value) ? value : 0;
  return (
    <label className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <div className="flex items-stretch gap-1.5">
        {!compact && (
          <button
            type="button"
            aria-label={`Decrease ${label}`}
            onClick={() => onChange(snap(safe - step, step))}
            className="w-12 shrink-0 rounded-xl border border-white/10 bg-white/5 text-lg text-white/70 transition active:scale-[0.96]"
          >
            −
          </button>
        )}
        <input
          className={`input tabular-nums ${accent}`}
          type="number"
          step={step}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        />
        {!compact && (
          <button
            type="button"
            aria-label={`Increase ${label}`}
            onClick={() => onChange(snap(safe + step, step))}
            className="w-12 shrink-0 rounded-xl border border-white/10 bg-white/5 text-lg text-white/70 transition active:scale-[0.96]"
          >
            +
          </button>
        )}
      </div>
    </label>
  );
}
