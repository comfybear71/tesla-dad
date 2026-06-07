/**
 * US market (NASDAQ) timing helpers, computed in America/New_York so daylight
 * saving is handled automatically (no fixed-UTC drift).
 *
 * Regular session: 09:30–16:00 ET, Monday–Friday. US market holidays are NOT
 * accounted for here — on a holiday the price is simply flat, which is a known
 * minor limitation noted in HANDOFF.md.
 */

export const MARKET_OPEN_MIN = 9 * 60 + 30; // 09:30 ET
export const MARKET_CLOSE_MIN = 16 * 60; // 16:00 ET

export interface NyTime {
  /** YYYY-MM-DD in ET, used as a per-day key. */
  dateStr: string;
  /** Minutes since ET midnight. */
  minutes: number;
  /** True Mon–Fri. */
  isWeekday: boolean;
  hour: number;
  minute: number;
  weekday: string;
}

export function nyTime(d: Date = new Date()): NyTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0; // some runtimes emit "24" for midnight
  const minute = parseInt(get("minute"), 10);
  const weekday = get("weekday");

  return {
    dateStr: `${year}-${month}-${day}`,
    minutes: hour * 60 + minute,
    isWeekday: !["Sat", "Sun"].includes(weekday),
    hour,
    minute,
    weekday,
  };
}
