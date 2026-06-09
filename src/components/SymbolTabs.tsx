"use client";

import Link from "next/link";

/** Horizontal ticker switcher shown at the top of every page. */
export function SymbolTabs({
  symbols,
  active,
  onSelect,
  showAdd = true,
}: {
  symbols: string[];
  active: string;
  onSelect: (symbol: string) => void;
  showAdd?: boolean;
}) {
  if (symbols.length === 0) return null;
  return (
    <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
      {symbols.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onSelect(s)}
          className={`inline-flex shrink-0 items-center rounded-full px-4 py-1.5 text-sm font-semibold tracking-wide transition active:scale-[0.97] ${
            s === active
              ? "bg-white text-ink"
              : "border border-white/15 bg-white/5 text-white/60 hover:bg-white/10"
          }`}
        >
          {s}
        </button>
      ))}
      {showAdd && (
        <Link
          href="/settings#watchlist"
          className="inline-flex shrink-0 items-center rounded-full border border-dashed border-white/20 px-3.5 py-1.5 text-sm font-medium text-white/40 transition hover:border-white/40 hover:text-white/70"
        >
          + Add
        </Link>
      )}
    </div>
  );
}
