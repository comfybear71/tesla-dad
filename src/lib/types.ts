// Shared domain types for Tesla Dad.

export type SignalAction = "BUY" | "SELL" | "HOLD";

/** A single tier in the 3-tier accumulation ladder. */
export interface Tier {
  /** Label shown in the UI, e.g. "Tier 1". */
  label: string;
  /** Percentage DROP from baseline that triggers a BUY at this tier (positive number, e.g. 3 = -3%). */
  buyDropPct: number;
  /** USD amount to deploy when this buy tier triggers (will be floored at minOrderUsd). */
  buyUsd: number;
  /** Percentage RISE from baseline that triggers a SELL at this tier (positive number, e.g. 10 = +10%). */
  sellRisePct: number;
  /** Number of TSLA shares to sell when this sell tier triggers. */
  sellShares: number;
}

/** User-editable configuration for the strategy. */
export interface Config {
  symbol: string;
  /** Reference price that deviations are measured from. Resets to the trade price after each executed trade. */
  baselinePrice: number;
  /** TSLA shares currently held. */
  sharesHeld: number;
  /** USD cash available to deploy. */
  cashUsd: number;
  /** Minimum order size in USD (CMC constraint). */
  minOrderUsd: number;
  /** Brokerage fee as a percentage of trade value (e.g. 0.1 = 0.1%). */
  feePct: number;
  /** Flat brokerage fee in USD added on top of feePct. */
  feeFlatUsd: number;
  /** The three accumulation tiers, ordered shallow -> deep. */
  tiers: Tier[];
  /** ISO timestamp the baseline was last set. */
  baselineSetAt: string;
}

/** A computed trade signal at a moment in time. */
export interface Signal {
  action: SignalAction;
  /** Index of the tier that triggered, or null for HOLD. */
  tierIndex: number | null;
  tierLabel: string | null;
  price: number;
  baselinePrice: number;
  /** Signed deviation from baseline as a percentage (negative = down). */
  deviationPct: number;
  /** For BUY: USD to deploy (incl. fees accounted separately). For SELL: gross proceeds. */
  amountUsd: number;
  /** For BUY: estimated shares acquired. For SELL: shares sold. */
  shares: number;
  /** Estimated brokerage fee in USD. */
  feeUsd: number;
  /** Human-readable one-line summary. */
  message: string;
  generatedAt: string;
}

/** A logged trade (executed manually by Dad, recorded here). */
export interface Trade {
  id: string;
  ts: string; // ISO timestamp
  action: "BUY" | "SELL";
  tierLabel: string | null;
  price: number;
  shares: number;
  amountUsd: number;
  feeUsd: number;
  /** Holdings snapshot AFTER this trade. */
  sharesAfter: number;
  cashAfter: number;
  note?: string;
}

/** A periodic price snapshot used to draw the price history chart. */
export interface PriceSnapshot {
  ts: string;
  price: number;
}

/** A real news headline from the market-data provider. */
export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  url: string;
  summary: string;
  /** ISO timestamp of publication. */
  datetime: string;
}

/** Per-asset section of the AI daily brief. */
export interface AssetBrief {
  symbol: string;
  sentiment: "bullish" | "bearish" | "neutral" | "mixed";
  /** Plain-English 2-3 sentence read on the asset. */
  summary: string;
  /** One concrete thing to keep an eye on. */
  watchFor: string;
}

/** AI-generated morning brief across the whole watchlist. Context only — never a trade instruction. */
export interface DailyBrief {
  /** ET date (YYYY-MM-DD) the brief covers — one per market day. */
  date: string;
  generatedAt: string;
  model: string;
  marketSummary: string;
  assets: AssetBrief[];
}

export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  /** Data source used. */
  source: string;
  ts: string;
}
