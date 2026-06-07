import { usd } from "@/lib/format";
import type { Config } from "@/lib/types";

export function PortfolioSummary({ config, price }: { config: Config; price: number }) {
  const positionValue = config.sharesHeld * price;
  const total = positionValue + config.cashUsd;

  return (
    <section className="card">
      <div className="mb-4 flex items-center justify-between">
        <p className="label">Portfolio</p>
        <p className="text-sm font-semibold">{usd(total, 0)}</p>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <Stat label="Shares" value={`${config.sharesHeld}`} />
        <Stat label="Position" value={usd(positionValue, 0)} />
        <Stat label="USD cash" value={usd(config.cashUsd, 0)} />
      </div>
      <p className="mt-4 text-center text-[11px] text-white/35">
        Goal: accumulate TSLA over 5 years 🚀
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/30 py-3">
      <p className="text-lg font-semibold">{value}</p>
      <p className="label mt-1">{label}</p>
    </div>
  );
}
