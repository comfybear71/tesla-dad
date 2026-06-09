import { usd } from "@/lib/format";
import type { Config } from "@/lib/types";

export function PortfolioSummary({
  config,
  price,
  change,
}: {
  config: Config;
  price: number;
  /** Today's per-share price change, used to show the position's day P&L. */
  change?: number;
}) {
  const hasPrice = price > 0;
  const positionValue = config.sharesHeld * price;
  const total = positionValue + config.cashUsd;
  const dayPnl = hasPrice && change != null ? change * config.sharesHeld : null;

  return (
    <section className="card">
      <div className="mb-4 flex items-center justify-between">
        <p className="label">Portfolio · {config.symbol}</p>
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums">{hasPrice ? usd(total, 0) : "—"}</p>
          {dayPnl != null && dayPnl !== 0 && (
            <p className={`text-[11px] font-medium tabular-nums ${dayPnl > 0 ? "text-signal-buy" : "text-tesla-red"}`}>
              {dayPnl > 0 ? "▲" : "▼"} {usd(Math.abs(dayPnl), 0)} today
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <Stat label="Shares" value={`${config.sharesHeld}`} />
        <Stat label="Position" value={hasPrice ? usd(positionValue, 0) : "—"} />
        <Stat label="USD cash" value={usd(config.cashUsd, 0)} />
      </div>
      <p className="mt-4 text-center text-[11px] text-white/35">
        Goal: accumulate over 5 years 🚀
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/30 py-3">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="label mt-1">{label}</p>
    </div>
  );
}
