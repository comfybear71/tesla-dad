import Link from "next/link";
import { pct, usd } from "@/lib/format";
import type { Signal } from "@/lib/types";

const THEME = {
  BUY: {
    ring: "border-signal-buy/40",
    glow: "from-signal-buy/20",
    text: "text-signal-buy",
    chip: "bg-signal-buy/15 text-signal-buy",
    label: "BUY SIGNAL",
  },
  SELL: {
    ring: "border-tesla-red/40",
    glow: "from-tesla-red/20",
    text: "text-tesla-red",
    chip: "bg-tesla-red/15 text-tesla-red",
    label: "SELL SIGNAL",
  },
  HOLD: {
    ring: "border-white/10",
    glow: "from-white/5",
    text: "text-white/70",
    chip: "bg-white/10 text-white/60",
    label: "HOLD",
  },
} as const;

export function SignalCard({ signal, symbol }: { signal: Signal; symbol: string }) {
  const t = THEME[signal.action];
  const actionable = signal.action !== "HOLD";
  const dev = pct(signal.deviationPct);

  return (
    <section className={`relative overflow-hidden rounded-2xl border ${t.ring} bg-carbon/80 p-5 shadow-glow`}>
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${t.glow} to-transparent`} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className={`rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.18em] ${t.chip}`}>
            {t.label}
          </span>
          {signal.tierLabel && (
            <span className="text-xs font-medium text-white/50">{signal.tierLabel}</span>
          )}
        </div>

        {actionable ? (
          <>
            <p className="mt-4 text-base font-medium leading-snug text-white/85">
              {signal.action === "BUY"
                ? `${symbol} is ${dev} below your baseline — time to buy the dip.`
                : `${symbol} is ${dev} above your baseline — time to take some profit.`}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Metric
                label={signal.action === "BUY" ? "Deploy" : "Net proceeds"}
                value={usd(signal.amountUsd, 0)}
                accent={t.text}
              />
              <Metric
                label={signal.action === "BUY" ? "Approx shares" : "Sell shares"}
                value={`${signal.shares}`}
                accent={t.text}
              />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-white/50">
              Est. fee {usd(signal.feeUsd)}. Signal only — review and place the order in CMC.
            </p>
            <Link
              href={`/trades?symbol=${encodeURIComponent(symbol)}&action=${signal.action}&price=${signal.price}&shares=${signal.shares}&tier=${encodeURIComponent(
                signal.tierLabel ?? "",
              )}`}
              className="btn-primary mt-4 w-full"
            >
              Log this trade
            </Link>
          </>
        ) : (
          <>
            <p className="mt-4 text-lg font-semibold text-white/85">Nothing to do right now</p>
            <p className="mt-1 text-sm leading-relaxed text-white/50">
              {symbol} is <span className="font-semibold text-white/75">{dev}</span> vs your
              baseline of {usd(signal.baselinePrice)} — no tier has triggered. You&apos;ll get a
              Telegram alert the moment one does.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}
