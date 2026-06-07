import type { Config } from "./types";

/**
 * Default strategy configuration, seeded from Dad's plan:
 *  - ~50 TSLA shares held
 *  - ~$5,000 USD cash
 *  - 3-tier accumulation ladder:
 *      Tier 1: -3% buy  / +10% sell
 *      Tier 2: -5% buy  / +15% sell
 *      Tier 3: -10% buy / +20% sell
 *  - Buys get bigger the deeper the drop; sells release a few shares on big rises.
 *  - CMC minimum order of $1,000, fees included.
 */
export const DEFAULT_CONFIG: Config = {
  symbol: "TSLA",
  baselinePrice: 0, // set on first quote / by Dad in Settings
  sharesHeld: 50,
  cashUsd: 5000,
  minOrderUsd: 1000,
  feePct: 0.1, // 0.1% brokerage
  feeFlatUsd: 0, // optional flat fee on top
  baselineSetAt: new Date(0).toISOString(),
  // Note: at ~$340/share a 1-2 share sell is below the $1,000 CMC minimum, so
  // sell sizes start at 3 shares (~$1,020) to clear it. All values editable in Settings.
  tiers: [
    { label: "Tier 1", buyDropPct: 3, buyUsd: 1000, sellRisePct: 10, sellShares: 3 },
    { label: "Tier 2", buyDropPct: 5, buyUsd: 1500, sellRisePct: 15, sellShares: 4 },
    { label: "Tier 3", buyDropPct: 10, buyUsd: 2500, sellRisePct: 20, sellShares: 5 },
  ],
};
