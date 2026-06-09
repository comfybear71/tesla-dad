import { pct, usd } from "@/lib/format";
import type { Config } from "@/lib/types";

/**
 * Vertical deviation ladder: sell tiers (rises) above the baseline, buy tiers
 * (drops) below it, with a live needle at the current deviation. Every tier
 * shows the actual trigger price in dollars so Dad knows exactly what number
 * to watch for.
 */
export function TierLadder({
  config,
  deviationPct,
  baselinePrice,
}: {
  config: Config;
  deviationPct: number;
  baselinePrice: number;
}) {
  const maxRise = Math.max(...config.tiers.map((t) => t.sellRisePct));
  const maxDrop = Math.max(...config.tiers.map((t) => t.buyDropPct));
  const top = maxRise + 4; // headroom
  const bottom = -(maxDrop + 4);
  const range = top - bottom;

  const posFor = (devPct: number) => {
    const clamped = Math.min(top, Math.max(bottom, devPct));
    return ((top - clamped) / range) * 100; // % from top
  };
  const zero = posFor(0);

  const priceAt = (devPct: number) =>
    baselinePrice > 0 ? usd(baselinePrice * (1 + devPct / 100)) : null;

  const sells = [...config.tiers].sort((a, b) => b.sellRisePct - a.sellRisePct);
  const buys = [...config.tiers].sort((a, b) => a.buyDropPct - b.buyDropPct);

  return (
    <section className="card">
      <div className="mb-4 flex items-center justify-between">
        <p className="label">Signal ladder</p>
        <p className="text-xs text-white/40">live position</p>
      </div>

      <div className="relative h-80 overflow-hidden rounded-xl bg-black/30">
        {/* sell zone (above baseline) / buy zone (below) */}
        <div
          className="absolute inset-x-0 top-0 bg-gradient-to-b from-tesla-red/10 to-transparent"
          style={{ height: `${zero}%` }}
        />
        <div
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-signal-buy/10 to-transparent"
          style={{ height: `${100 - zero}%` }}
        />

        {/* baseline — drawn at the true zero-deviation position */}
        <div
          className="absolute inset-x-4 flex items-center gap-2"
          style={{ top: `${zero}%`, transform: "translateY(-50%)" }}
        >
          <div className="h-px flex-1 bg-white/25" />
          <span className="text-[10px] uppercase tracking-widest text-white/45">
            baseline{baselinePrice > 0 ? ` ${usd(baselinePrice)}` : ""}
          </span>
          <div className="h-px flex-1 bg-white/25" />
        </div>

        {/* sell markers */}
        {sells.map((t) => (
          <Marker
            key={`s-${t.label}`}
            top={posFor(t.sellRisePct)}
            color="sell"
            title={`Sell ${t.sellShares} sh`}
            price={priceAt(t.sellRisePct)}
            pctLabel={`+${t.sellRisePct}%`}
          />
        ))}

        {/* buy markers */}
        {buys.map((t) => (
          <Marker
            key={`b-${t.label}`}
            top={posFor(t.buyDropPct * -1)}
            color="buy"
            title={`Buy ${usd(t.buyUsd, 0)}`}
            price={priceAt(-t.buyDropPct)}
            pctLabel={`-${t.buyDropPct}%`}
          />
        ))}

        {/* live needle */}
        <div
          className="absolute inset-x-0 flex items-center transition-[top] duration-700 ease-out"
          style={{ top: `${posFor(deviationPct)}%`, transform: "translateY(-50%)" }}
        >
          <div className="mx-3 h-[2px] flex-1 bg-white/70" />
          <span className="mr-3 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold tabular-nums text-ink shadow">
            {pct(deviationPct)}
          </span>
        </div>
      </div>
    </section>
  );
}

function Marker({
  top,
  color,
  title,
  price,
  pctLabel,
}: {
  top: number;
  color: "buy" | "sell";
  title: string;
  price: string | null;
  pctLabel: string;
}) {
  const dot = color === "buy" ? "bg-signal-buy" : "bg-tesla-red";
  const text = color === "buy" ? "text-signal-buy" : "text-tesla-red";
  return (
    <div
      className="absolute left-4 right-4 flex items-center justify-between"
      style={{ top: `${top}%`, transform: "translateY(-50%)" }}
    >
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="text-xs font-medium text-white/70">{title}</span>
      </div>
      <span className="text-xs tabular-nums">
        {price && <span className="font-semibold text-white/85">{price}</span>}
        <span className={`ml-1.5 font-semibold ${text}`}>{pctLabel}</span>
      </span>
    </div>
  );
}
