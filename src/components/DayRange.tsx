import { usd } from "@/lib/format";
import type { Quote } from "@/lib/types";

/** Today's low–high range with a marker at the current price. */
export function DayRange({ quote }: { quote: Quote }) {
  const { low, high, price, open, prevClose } = quote;
  if (!(high > low) || low <= 0) return null;
  const pos = Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100));

  return (
    <div className="mt-6 w-full max-w-[260px]">
      <div className="relative h-1.5 rounded-full bg-gradient-to-r from-white/15 via-white/10 to-white/15">
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-white shadow transition-[left] duration-700 ease-out"
          style={{ left: `${pos}%` }}
        />
      </div>
      <div className="mt-2 flex items-baseline justify-between text-[10px] tabular-nums text-white/45">
        <span>{usd(low)}</span>
        <span className="uppercase tracking-[0.18em] text-white/25">today</span>
        <span>{usd(high)}</span>
      </div>
      <div className="mt-2 flex justify-center gap-5 text-[10px] tabular-nums text-white/35">
        <span>
          Open <span className="text-white/55">{usd(open)}</span>
        </span>
        <span>
          Prev close <span className="text-white/55">{usd(prevClose)}</span>
        </span>
      </div>
    </div>
  );
}
