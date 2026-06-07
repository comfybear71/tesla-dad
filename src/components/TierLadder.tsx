import { pct } from "@/lib/format";
import type { Config } from "@/lib/types";

/**
 * Vertical deviation ladder: sell tiers (rises) above the baseline, buy tiers
 * (drops) below it, with a live needle at the current deviation.
 */
export function TierLadder({ config, deviationPct }: { config: Config; deviationPct: number }) {
  const maxRise = Math.max(...config.tiers.map((t) => t.sellRisePct));
  const maxDrop = Math.max(...config.tiers.map((t) => t.buyDropPct));
  const top = maxRise + 4; // headroom
  const bottom = -(maxDrop + 4);
  const range = top - bottom;

  const posFor = (devPct: number) => {
    const clamped = Math.min(top, Math.max(bottom, devPct));
    return ((top - clamped) / range) * 100; // % from top
  };

  const sells = [...config.tiers].sort((a, b) => b.sellRisePct - a.sellRisePct);
  const buys = [...config.tiers].sort((a, b) => a.buyDropPct - b.buyDropPct);

  return (
    <section className="card">
      <div className="mb-4 flex items-center justify-between">
        <p className="label">Signal ladder</p>
        <p className="text-xs text-white/40">live position</p>
      </div>

      <div className="relative h-64 rounded-xl bg-black/30 px-4">
        {/* center baseline */}
        <div className="absolute inset-x-4 top-1/2 flex items-center gap-2">
          <div className="h-px flex-1 bg-white/20" />
          <span className="text-[10px] uppercase tracking-widest text-white/40">baseline</span>
          <div className="h-px flex-1 bg-white/20" />
        </div>

        {/* sell markers */}
        {sells.map((t) => (
          <Marker key={`s-${t.label}`} top={posFor(t.sellRisePct)} color="text-tesla-red" side="right"
            title={`SELL ${t.label}`} detail={`+${t.sellRisePct}% · ${t.sellShares} sh`} />
        ))}

        {/* buy markers */}
        {buys.map((t) => (
          <Marker key={`b-${t.label}`} top={posFor(t.buyDropPct * -1)} color="text-signal-buy" side="right"
            title={`BUY ${t.label}`} detail={`-${t.buyDropPct}% · $${t.buyUsd}`} />
        ))}

        {/* live needle */}
        <div
          className="absolute inset-x-0 flex items-center"
          style={{ top: `${posFor(deviationPct)}%`, transform: "translateY(-50%)" }}
        >
          <div className="mx-3 h-[2px] flex-1 bg-white/70" />
          <span className="mr-3 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-ink">
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
  detail,
}: {
  top: number;
  color: string;
  side: "left" | "right";
  title: string;
  detail: string;
}) {
  return (
    <div className="absolute left-4 right-4 flex items-center justify-between" style={{ top: `${top}%`, transform: "translateY(-50%)" }}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${color.replace("text-", "bg-")}`} />
        <span className="text-xs font-medium text-white/70">{title}</span>
      </div>
      <span className={`text-xs font-semibold ${color}`}>{detail}</span>
    </div>
  );
}
