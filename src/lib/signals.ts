import type { Config, Signal, Tier } from "./types";

/** Fee in USD for a given gross trade value. */
export function estimateFee(config: Config, grossUsd: number): number {
  return +(grossUsd * (config.feePct / 100) + config.feeFlatUsd).toFixed(2);
}

/**
 * Compute the current signal given a live price and the strategy config.
 *
 * Logic:
 *  - deviation = (price - baseline) / baseline
 *  - BUY: choose the DEEPEST buy tier whose drop threshold is met (more dip = bigger buy)
 *  - SELL: choose the HIGHEST sell tier whose rise threshold is met
 *  - Buy size is floored at minOrderUsd and capped at available cash
 *  - Sell must clear minOrderUsd in gross proceeds, else it's a HOLD
 */
export function computeSignal(config: Config, price: number): Signal {
  const now = new Date().toISOString();
  const baseline = config.baselinePrice > 0 ? config.baselinePrice : price;
  const deviationPct = +(((price - baseline) / baseline) * 100).toFixed(2);

  // Tiers sorted so we can pick the most extreme triggered one.
  const buyTiers = [...config.tiers].sort((a, b) => b.buyDropPct - a.buyDropPct); // deepest first
  const sellTiers = [...config.tiers].sort((a, b) => b.sellRisePct - a.sellRisePct); // highest first

  if (deviationPct <= 0) {
    const drop = Math.abs(deviationPct);
    const tier = buyTiers.find((t) => drop >= t.buyDropPct);
    if (tier) return buySignal(config, price, baseline, deviationPct, tier, now);
  } else {
    const tier = sellTiers.find((t) => deviationPct >= t.sellRisePct);
    if (tier) return sellSignal(config, price, baseline, deviationPct, tier, now);
  }

  return {
    action: "HOLD",
    tierIndex: null,
    tierLabel: null,
    price,
    baselinePrice: baseline,
    deviationPct,
    amountUsd: 0,
    shares: 0,
    feeUsd: 0,
    message: `HOLD — TSLA ${fmtSigned(deviationPct)}% vs baseline $${baseline.toFixed(2)}. No tier triggered.`,
    generatedAt: now,
  };
}

function buySignal(
  config: Config,
  price: number,
  baseline: number,
  deviationPct: number,
  tier: Tier,
  now: string,
): Signal {
  const tierIndex = config.tiers.findIndex((t) => t.label === tier.label);
  // Deploy the tier amount, floored at the CMC minimum, capped at available cash.
  let amountUsd = Math.max(tier.buyUsd, config.minOrderUsd);
  amountUsd = Math.min(amountUsd, config.cashUsd);
  const fee = estimateFee(config, amountUsd);
  const net = Math.max(0, amountUsd - fee);
  const shares = +(net / price).toFixed(4);
  const enough = config.cashUsd >= config.minOrderUsd;

  return {
    action: enough ? "BUY" : "HOLD",
    tierIndex: enough ? tierIndex : null,
    tierLabel: enough ? tier.label : null,
    price,
    baselinePrice: baseline,
    deviationPct,
    amountUsd: enough ? +amountUsd.toFixed(2) : 0,
    shares: enough ? shares : 0,
    feeUsd: enough ? fee : 0,
    message: enough
      ? `BUY (${tier.label}) — TSLA ${fmtSigned(deviationPct)}%. Deploy $${amountUsd.toFixed(
          0,
        )} (~${shares} shares incl. ~$${fee.toFixed(2)} fee).`
      : `BUY signal (${tier.label}) but cash $${config.cashUsd.toFixed(
          0,
        )} is below the $${config.minOrderUsd} minimum — HOLD.`,
    generatedAt: now,
  };
}

function sellSignal(
  config: Config,
  price: number,
  baseline: number,
  deviationPct: number,
  tier: Tier,
  now: string,
): Signal {
  const tierIndex = config.tiers.findIndex((t) => t.label === tier.label);
  const shares = Math.min(tier.sellShares, config.sharesHeld);
  const gross = +(shares * price).toFixed(2);
  const fee = estimateFee(config, gross);
  const net = +(gross - fee).toFixed(2);
  const ok = shares > 0 && gross >= config.minOrderUsd;

  return {
    action: ok ? "SELL" : "HOLD",
    tierIndex: ok ? tierIndex : null,
    tierLabel: ok ? tier.label : null,
    price,
    baselinePrice: baseline,
    deviationPct,
    amountUsd: ok ? net : 0,
    shares: ok ? shares : 0,
    feeUsd: ok ? fee : 0,
    message: ok
      ? `SELL (${tier.label}) — TSLA ${fmtSigned(deviationPct)}%. Sell ${shares} share${
          shares === 1 ? "" : "s"
        } → ~$${net.toFixed(0)} net (after ~$${fee.toFixed(2)} fee).`
      : shares === 0
        ? `SELL signal (${tier.label}) but no shares held — HOLD.`
        : `SELL signal (${tier.label}) but proceeds $${gross.toFixed(
            0,
          )} below $${config.minOrderUsd} minimum — HOLD.`,
    generatedAt: now,
  };
}

function fmtSigned(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/** A stable key identifying a signal "event", used to avoid re-notifying for the same condition. */
export function signalKey(signal: Signal): string {
  if (signal.action === "HOLD") return "HOLD";
  return `${signal.action}:${signal.tierLabel}`;
}
