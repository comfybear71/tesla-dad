"use client";

import { useCallback, useEffect, useState } from "react";
import { usd } from "@/lib/format";
import type { Config, Quote, Tier } from "@/lib/types";

export default function SettingsPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    const [c, q] = await Promise.all([
      fetch("/api/config", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/quote", { cache: "no-store" }).then((r) => r.json()),
    ]);
    setConfig(c);
    setQuote(q);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!config) return <div className="py-10 text-center text-white/40">Loading…</div>;

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
    setStatus("Saving…");
    const res = await fetch("/api/config", {
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

  return (
    <main className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        {status && <span className="text-xs text-white/60">{status}</span>}
      </header>

      {/* Baseline */}
      <section className="card">
        <p className="label mb-3">Baseline</p>
        <p className="mb-3 text-xs text-white/40">
          Deviations are measured from here. It resets automatically after each logged trade.
        </p>
        <NumberField label="Baseline price (USD)" value={config.baselinePrice} onChange={(v) => setField("baselinePrice", v)} step={0.01} />
        {quote && (
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
      <section className="card grid grid-cols-2 gap-3">
        <div className="col-span-2"><p className="label">Holdings</p></div>
        <NumberField label="TSLA shares" value={config.sharesHeld} onChange={(v) => setField("sharesHeld", v)} step={1} />
        <NumberField label="USD cash" value={config.cashUsd} onChange={(v) => setField("cashUsd", v)} step={100} />
      </section>

      {/* Order rules */}
      <section className="card grid grid-cols-2 gap-3">
        <div className="col-span-2"><p className="label">Order rules (CMC)</p></div>
        <NumberField label="Min order (USD)" value={config.minOrderUsd} onChange={(v) => setField("minOrderUsd", v)} step={100} />
        <NumberField label="Fee %" value={config.feePct} onChange={(v) => setField("feePct", v)} step={0.01} />
        <NumberField label="Flat fee (USD)" value={config.feeFlatUsd} onChange={(v) => setField("feeFlatUsd", v)} step={1} />
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
                <NumberField label="Buy on drop %" value={t.buyDropPct} onChange={(v) => setTier(i, "buyDropPct", v)} step={0.5} accent="text-signal-buy" />
                <NumberField label="Deploy USD" value={t.buyUsd} onChange={(v) => setTier(i, "buyUsd", v)} step={100} accent="text-signal-buy" />
                <NumberField label="Sell on rise %" value={t.sellRisePct} onChange={(v) => setTier(i, "sellRisePct", v)} step={0.5} accent="text-tesla-red" />
                <NumberField label="Sell shares" value={t.sellShares} onChange={(v) => setTier(i, "sellShares", v)} step={1} accent="text-tesla-red" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <button onClick={save} className="btn-primary w-full">Save settings</button>
      <button onClick={testTelegram} className="btn-ghost w-full">Send test Telegram</button>

      <p className="px-2 text-center text-[11px] leading-relaxed text-white/30">
        This is a signal tool only. It never places real orders. Review every alert and trade through CMC yourself.
      </p>
    </main>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  accent = "text-white",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  accent?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <input
        className={`input ${accent}`}
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </label>
  );
}
