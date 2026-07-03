// US market clock helpers (America/New_York), no external deps.
// The screening "trading day" starts at pre-market open, 04:00 ET.

export type MarketPhase = "pre" | "regular" | "post" | "closed";

interface EtParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function etNow(date: Date = new Date()): EtParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24, // "24" can appear for midnight
    minute: Number(parts.minute),
    weekday: WEEKDAYS.indexOf(parts.weekday),
  };
}

// pre: 04:00–09:30 ET · regular: 09:30–16:00 · post: 16:00–20:00
// closed: overnight + weekends (US holidays are not modeled; the
// screener just re-serves the last session's data on those days)
export function marketPhase(date: Date = new Date()): MarketPhase {
  const et = etNow(date);
  if (et.weekday === 0 || et.weekday === 6) return "closed";
  const mins = et.hour * 60 + et.minute;
  if (mins >= 4 * 60 && mins < 9 * 60 + 30) return "pre";
  if (mins >= 9 * 60 + 30 && mins < 16 * 60) return "regular";
  if (mins >= 16 * 60 && mins < 20 * 60) return "post";
  return "closed";
}

// Day key with the boundary at 04:00 ET: everything from 04:00 today
// until 03:59 tomorrow shares one key, so the screen list rebuilds
// exactly once per day, at pre-market start.
export function tradingDayKey(date: Date = new Date()): string {
  // Shift back 4 hours in ET terms by subtracting 4h of real time from
  // the ET-rendered clock (ET has no discontinuities except DST shifts,
  // which at 2 AM are safely inside the same trading-day window).
  const shifted = new Date(date.getTime() - 4 * 3600_000);
  const et = etNow(shifted);
  const mm = String(et.month).padStart(2, "0");
  const dd = String(et.day).padStart(2, "0");
  return `${et.year}-${mm}-${dd}`;
}
