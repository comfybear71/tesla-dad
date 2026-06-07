import { promises as fs } from "fs";
import path from "path";
import type { Config, Trade, PriceSnapshot } from "./types";
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
 * Keys:
 *   tesla-dad:config        -> Config
 *   tesla-dad:trades        -> Trade[]
 *   tesla-dad:snapshots     -> PriceSnapshot[]
 *   tesla-dad:lastSignalKey -> string (dedupe key so we don't spam Telegram)
 *   tesla-dad:daily         -> DailyState (open/close summary sent flags)
 */

const KEY = {
  config: "tesla-dad:config",
  trades: "tesla-dad:trades",
  snapshots: "tesla-dad:snapshots",
  lastSignal: "tesla-dad:lastSignalKey",
  daily: "tesla-dad:daily",
};

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

// ---------- Public API ----------

export async function getConfig(): Promise<Config> {
  const stored = await get<Config>(KEY.config);
  if (!stored) return DEFAULT_CONFIG;
  // Merge so newly-added fields always have a value.
  return { ...DEFAULT_CONFIG, ...stored, tiers: stored.tiers ?? DEFAULT_CONFIG.tiers };
}

export async function saveConfig(config: Config): Promise<void> {
  await set(KEY.config, config);
}

export async function getTrades(): Promise<Trade[]> {
  return (await get<Trade[]>(KEY.trades)) ?? [];
}

export async function saveTrades(trades: Trade[]): Promise<void> {
  await set(KEY.trades, trades);
}

export async function addTrade(trade: Trade): Promise<Trade[]> {
  const trades = await getTrades();
  trades.unshift(trade);
  await saveTrades(trades);
  return trades;
}

export async function getSnapshots(): Promise<PriceSnapshot[]> {
  return (await get<PriceSnapshot[]>(KEY.snapshots)) ?? [];
}

export async function addSnapshot(snap: PriceSnapshot): Promise<void> {
  const snaps = await getSnapshots();
  snaps.push(snap);
  // Keep the array bounded.
  const trimmed = snaps.slice(-MAX_SNAPSHOTS);
  await set(KEY.snapshots, trimmed);
}

export async function getLastSignalKey(): Promise<string | null> {
  return get<string>(KEY.lastSignal);
}

export async function setLastSignalKey(key: string): Promise<void> {
  await set(KEY.lastSignal, key);
}

/** Tracks whether the open/close Telegram summaries have been sent for a given ET day. */
export interface DailyState {
  date: string; // YYYY-MM-DD in ET
  openSent: boolean;
  closeSent: boolean;
}

export async function getDailyState(): Promise<DailyState | null> {
  return get<DailyState>(KEY.daily);
}

export async function setDailyState(state: DailyState): Promise<void> {
  await set(KEY.daily, state);
}

export const storageMode = useKv ? "vercel-kv" : "file";
