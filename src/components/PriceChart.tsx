"use client";

import {
  Area,
  AreaChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PriceSnapshot, Trade } from "@/lib/types";

export function PriceChart({
  snapshots,
  trades,
}: {
  snapshots: PriceSnapshot[];
  trades: Trade[];
}) {
  const data = snapshots.map((s) => ({ t: new Date(s.ts).getTime(), price: s.price }));

  if (data.length < 2) {
    return (
      <div className="flex h-56 flex-col items-center justify-center rounded-xl bg-black/30 text-center text-sm text-white/40">
        <p>Price history is being collected.</p>
        <p className="mt-1 text-xs text-white/30">
          The chart fills in from real quotes every 15 min once the price source is connected.
        </p>
      </div>
    );
  }

  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pad = Math.max(2, (max - min) * 0.1);

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e31937" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#e31937" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t) => new Date(t).toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            domain={[min - pad, max + pad]}
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(v) => `$${Math.round(v)}`}
          />
          <Tooltip
            contentStyle={{
              background: "#141414",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              color: "#fff",
              fontSize: 12,
            }}
            labelFormatter={(t) => new Date(t as number).toLocaleString("en-AU")}
            formatter={(v: number) => [`$${v.toFixed(2)}`, "TSLA"]}
          />
          <Area type="monotone" dataKey="price" stroke="#e31937" strokeWidth={2} fill="url(#priceFill)" />
          {trades.map((tr) => (
            <ReferenceDot
              key={tr.id}
              x={new Date(tr.ts).getTime()}
              y={tr.price}
              r={5}
              fill={tr.action === "BUY" ? "#22c55e" : "#e31937"}
              stroke="#0a0a0a"
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
