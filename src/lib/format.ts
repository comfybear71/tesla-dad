export function usd(n: number | null | undefined, digits = 2): string {
  const v = Number.isFinite(n) ? (n as number) : 0;
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function pct(n: number | null | undefined): string {
  const v = Number(((Number.isFinite(n) ? (n as number) : 0)).toFixed(2));
  return `${v > 0 ? "+" : ""}${v}%`;
}

export function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function shortDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
