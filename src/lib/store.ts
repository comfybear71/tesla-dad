import { promises as fs } from "fs";
import path from "path";
import type { Config, Trade, PriceSnapshot, DailyBrief } from "./types";
import { DEFAULT_CONFIG } from "./defaults";

/**
 * Pluggable persistence layer.
 *
 * In production (Vercel) it uses Upstash Redis over REST when its env vars are
 * present. It accepts BOTH naming schemes so it works whether the database was
 * added as the legacy "Vercel KV" (KV_REST_API_URL / KV_REST_API_TOKEN) or via
 * the newer Upstash marketplace integration (UPSTASH_REDIS_REST_URL /
 * UPSTASH_REDIS_REST_TOKEN). For local development (or any host without it
 * configured) it falls back to a JSON file under ./.data.
 *
 * Keys (one set per tracked symbol):
 *   tesla-dad:watchlist          -> string[] of tracked symbols
 *   tesla-dad:config             -> Config        (TSLA — original keys)
 *   tesla-dad:<SYM>:config       -> Config        (every other symbol)
 *   ...same pattern for trades / snapshots / lastSignalKey / daily.
 *
 * TSLA keeps the original un-namespaced keys so production data written before
 * multi-asset support is picked up without any migration.
 */

type KeySuffix = "config" | "trades" | "snapshots" | "lastSignalKey" | "daily";

const PREFIX = "tesla-dad";
const WATCHLIST_KEY = `${PREFIX}:watchlist`;

function keyFor(suffix: KeySuffix, symbol: string): string {
  return symbol === "TSLA" ? `${PREFIX}:${suffix}` : `${PREFIX}:${symbol}:${suffix}`;
}

const MAX_SNAPSHOTS = 2000;

const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const useKv = Boolean(kvUrl && kvToken);

// ---------- Vercel KV (Upstash REST) ----------

async function kvGet<T>(key: string): Promise<T | null> {
  const res = await fetch(`${kvUrl}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${kvToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { result: string | null };
  if (data.result == null) return null;
  try {
    return JSON.parse(data.result) as T;
  } catch {
    return null;
  }
}

async function kvSet<T>(key: string, value: T): Promise<void> {
  await fetch(`${kvUrl}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${kvToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(value),
  });
}

// ---------- File fallback ----------

const dataDir = path.join(process.cwd(), ".data");

async function fileGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(path.join(dataDir, `${safeName(key)}.json`), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function fileSet<T>(key: string, value: T): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(
    path.join(dataDir, `${safeName(key)}.json`),
    JSON.stringify(value, null, 2),
    "utf8",
  );
}

function safeName(key: string): string {
  return key.replace(/[^a-z0-9]+/gi, "_");
}

// ---------- Unified get/set ----------

async function get<T>(key: string): Promise<T | null> {
  return useKv ? kvGet<T>(key) : fileGet<T>(key);
}

async function set<T>(key: string, value: T): Promise<void> {
  return useKv ? kvSet<T>(key, value) : fileSet<T>(key, value);
}

// ---------- Symbols / watchlist ----------

/** Uppercase + validate a user-supplied ticker. Returns null if it isn't one. */
export function normalizeSymbol(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  return /^[A-Z][A-Z0-9.\-]{0,9}$/.test(s) ? s : null;
}

export async function getWatchlist(): Promise<string[]> {
  const list = await get<string[]>(WATCHLIST_KEY);
  return list && list.length > 0 ? list : ["TSLA"];
}

export async function saveWatchlist(symbols: string[]): Promise<void> {
  await set(WATCHLIST_KEY, symbols);
}

/**
 * Resolve a raw `?symbol=` query value to a tracked symbol. Falls back to the
 * first watchlist entry, and never returns a symbol outside the watchlist (so
 * arbitrary query strings can't create stray storage keys).
 */
export async function resolveSymbol(raw: string | null | undefined): Promise<string> {
  const requested = normalizeSymbol(raw);
  const watchlist = await getWatchlist();
  return requested && watchlist.includes(requested) ? requested : watchlist[0];
}

// ---------- Per-symbol config / trades / snapshots ----------

/** Defaults for a symbol: TSLA keeps Dad's seeded plan; new assets start empty. */
export function defaultConfigFor(symbol: string): Config {
  if (symbol === DEFAULT_CONFIG.symbol) return DEFAULT_CONFIG;
  return { ...DEFAULT_CONFIG, symbol, baselinePrice: 0, sharesHeld: 0, cashUsd: 0 };
}

export async function getConfig(symbol: string): Promise<Config> {
  const stored = await get<Config>(keyFor("config", symbol));
  const def = defaultConfigFor(symbol);
  if (!stored) return def;
  // Merge so newly-added fields always have a value.
  return { ...def, ...stored, symbol, tiers: stored.tiers ?? def.tiers };
}

export async function saveConfig(config: Config): Promise<void> {
  await set(keyFor("config", config.symbol), config);
}

export async function getTrades(symbol: string): Promise<Trade[]> {
  return (await get<Trade[]>(keyFor("trades", symbol))) ?? [];
}

export async function saveTrades(symbol: string, trades: Trade[]): Promise<void> {
  await set(keyFor("trades", symbol), trades);
}

export async function addTrade(symbol: string, trade: Trade): Promise<Trade[]> {
  const trades = await getTrades(symbol);
  trades.unshift(trade);
  await saveTrades(symbol, trades);
  return trades;
}

export async function getSnapshots(symbol: string): Promise<PriceSnapshot[]> {
  return (await get<PriceSnapshot[]>(keyFor("snapshots", symbol))) ?? [];
}

export async function addSnapshot(symbol: string, snap: PriceSnapshot): Promise<void> {
  const snaps = await getSnapshots(symbol);
  snaps.push(snap);
  // Keep the array bounded.
  const trimmed = snaps.slice(-MAX_SNAPSHOTS);
  await set(keyFor("snapshots", symbol), trimmed);
}

export async function getLastSignalKey(symbol: string): Promise<string | null> {
  return get<string>(keyFor("lastSignalKey", symbol));
}

export async function setLastSignalKey(symbol: string, key: string): Promise<void> {
  await set(keyFor("lastSignalKey", symbol), key);
}

/** Tracks per-ET-day Telegram sends: open/close summaries + premarket gap alert. */
export interface DailyState {
  date: string; // YYYY-MM-DD in ET
  openSent: boolean;
  closeSent: boolean;
  /** Premarket gap alert sent today (optional: absent on records from older versions). */
  gapSent?: boolean;
}

export async function getDailyState(symbol: string): Promise<DailyState | null> {
  return get<DailyState>(keyFor("daily", symbol));
}

export async function setDailyState(symbol: string, state: DailyState): Promise<void> {
  await set(keyFor("daily", symbol), state);
}

// ---------- AI daily brief (one per ET market day, watchlist-wide) ----------

const BRIEF_KEY = `${PREFIX}:brief`;

export async function getDailyBrief(): Promise<DailyBrief | null> {
  return get<DailyBrief>(BRIEF_KEY);
}

export async function saveDailyBrief(brief: DailyBrief): Promise<void> {
  await set(BRIEF_KEY, brief);
}

export const storageMode = useKv ? "vercel-kv" : "file";
