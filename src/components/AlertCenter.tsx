"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { evaluateAlerts, type LevelAlert } from "@/lib/alerts";
import { fmtTimeTh, fmtUsd, LEVEL_COLORS } from "@/lib/format";
import type { StockPick } from "@/lib/types";
import { useQuotes, useScreen } from "./useScreen";
import { useAnalyzedPicks, useWatchlist } from "./useWatchlist";

const FIRED_KEY = "alerts:fired";
const LOG_KEY = "alerts:log";
const MAX_LOG = 50;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// Watches live quotes of the top-10 picks + watchlist and fires alerts
// when price reaches the entry (OB), take-profit, or stop-loss level.
export default function AlertCenter() {
  const { data } = useScreen();
  const { symbols: watchSymbols } = useWatchlist();
  const { picks: watchPicks } = useAnalyzedPicks(watchSymbols);

  // Screen picks take priority over watchlist analysis for the same symbol
  const allPicks = useMemo(() => {
    const map = new Map<string, StockPick>();
    for (const s of watchSymbols) {
      if (watchPicks[s]) map.set(s, watchPicks[s]);
    }
    for (const p of data?.picks ?? []) map.set(p.symbol, p);
    return Array.from(map.values());
  }, [data, watchPicks, watchSymbols]);

  const symbols = useMemo(() => allPicks.map((p) => p.symbol), [allPicks]);
  const quotes = useQuotes(symbols);

  const [alerts, setAlerts] = useState<LevelAlert[]>([]);
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState<number>(0);
  const [notifState, setNotifState] = useState<string>("unsupported");
  const firedRef = useRef<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  // Restore persisted state on mount
  useEffect(() => {
    firedRef.current = new Set(readJson<string[]>(FIRED_KEY, []));
    setAlerts(readJson<LevelAlert[]>(LOG_KEY, []));
    setSeenAt(Number(window.localStorage.getItem("alerts:seenAt") ?? 0));
    if (typeof Notification !== "undefined") {
      setNotifState(Notification.permission);
    }
  }, []);

  // Evaluate alerts whenever fresh quotes arrive
  useEffect(() => {
    if (allPicks.length === 0) return;
    const fresh: LevelAlert[] = [];
    for (const pick of allPicks) {
      const quote = quotes[pick.symbol];
      if (!quote) continue;
      fresh.push(...evaluateAlerts(pick, quote, firedRef.current));
    }
    if (fresh.length === 0) return;

    for (const a of fresh) firedRef.current.add(a.key);
    window.localStorage.setItem(
      FIRED_KEY,
      JSON.stringify(Array.from(firedRef.current).slice(-300))
    );
    setAlerts((prev) => {
      const next = [...fresh, ...prev].slice(0, MAX_LOG);
      window.localStorage.setItem(LOG_KEY, JSON.stringify(next));
      return next;
    });

    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      for (const a of fresh) {
        new Notification(`SMC Scanner · ${a.symbol}`, { body: a.messageTh });
      }
    }
  }, [quotes, allPicks]);

  // Close the panel on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const unseen = alerts.filter((a) => a.time > seenAt).length;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      const now = Date.now();
      setSeenAt(now);
      window.localStorage.setItem("alerts:seenAt", String(now));
    }
  };

  const requestNotif = async () => {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setNotifState(perm);
  };

  return (
    <div className="relative ml-auto" ref={panelRef}>
      <button
        onClick={toggle}
        aria-label="การแจ้งเตือนระดับราคา"
        className="relative rounded-md border border-border px-3 py-1.5 text-sm text-ink-2 hover:bg-grid hover:text-ink"
      >
        🔔
        {unseen > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-down px-1 text-[10px] font-bold text-ink">
            {unseen}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-96 max-w-[90vw] rounded-lg border border-border bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">การแจ้งเตือนระดับราคา</h3>
            {notifState === "default" && (
              <button
                onClick={requestNotif}
                className="rounded-md border border-border px-2 py-1 text-xs text-ink-2 hover:bg-grid"
              >
                เปิดแจ้งเตือนเบราว์เซอร์
              </button>
            )}
          </div>
          {alerts.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">
              ยังไม่มีการแจ้งเตือน — ระบบจะแจ้งเมื่อราคาแตะจุดเข้าซื้อ (OB),
              Take Profit หรือ Stop Loss ของหุ้นแนะนำและ Watchlist
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-grid overflow-y-auto">
              {alerts.map((a) => (
                <li key={a.key + a.time}>
                  <Link
                    href={`/graph/${a.symbol}`}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-2.5 px-4 py-3 hover:bg-grid/40"
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 inline-block h-2 w-2 flex-none rounded-full"
                      style={{ backgroundColor: LEVEL_COLORS[a.level] }}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm text-ink">
                        {a.messageTh}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        ราคา {fmtUsd(a.price)} · {fmtTimeTh(a.time)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
