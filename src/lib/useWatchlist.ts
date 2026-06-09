"use client";

import { useCallback, useEffect, useState } from "react";

const LS_KEY = "tesla-dad:symbol";

/**
 * Client-side watchlist state shared by all pages: the list of tracked
 * symbols plus the currently selected one (remembered in localStorage).
 * `symbol` is "" until the watchlist has loaded — pages should wait for it
 * before fetching symbol-scoped data.
 */
export function useWatchlist(preferred?: string | null) {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [symbol, setActive] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/watchlist", { cache: "no-store" });
        const { symbols: list } = (await res.json()) as { symbols: string[] };
        if (cancelled || !list?.length) return;
        setSymbols(list);
        const saved = window.localStorage.getItem(LS_KEY);
        const want =
          preferred && list.includes(preferred)
            ? preferred
            : saved && list.includes(saved)
              ? saved
              : list[0];
        setActive(want);
      } catch {
        if (!cancelled) {
          setSymbols(["TSLA"]);
          setActive("TSLA");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preferred]);

  const setSymbol = useCallback((s: string) => {
    setActive(s);
    window.localStorage.setItem(LS_KEY, s);
  }, []);

  /** Re-fetch the list (after add/remove) and keep the selection valid. */
  const reload = useCallback(async (): Promise<string[]> => {
    const res = await fetch("/api/watchlist", { cache: "no-store" });
    const { symbols: list } = (await res.json()) as { symbols: string[] };
    setSymbols(list);
    setActive((curr) => (list.includes(curr) ? curr : list[0]));
    return list;
  }, []);

  return { symbol, symbols, setSymbol, reload };
}
