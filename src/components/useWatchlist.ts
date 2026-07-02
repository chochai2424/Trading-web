"use client";

import { useCallback, useEffect, useState } from "react";
import type { StockPick } from "@/lib/types";

const STORAGE_KEY = "watchlist";

function readWatchlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// localStorage-backed personal ticker list, synced across tabs/components.
export function useWatchlist() {
  const [symbols, setSymbols] = useState<string[]>([]);

  useEffect(() => {
    setSymbols(readWatchlist());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setSymbols(readWatchlist());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: string[]) => {
    setSymbols(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const add = useCallback(
    (symbol: string) => {
      const s = symbol.trim().toUpperCase();
      if (!s || !/^[A-Z0-9.\-]{1,10}$/.test(s)) return false;
      const current = readWatchlist();
      if (current.includes(s)) return false;
      persist([...current, s]);
      return true;
    },
    [persist]
  );

  const remove = useCallback(
    (symbol: string) => {
      persist(readWatchlist().filter((s) => s !== symbol));
    },
    [persist]
  );

  const has = useCallback(
    (symbol: string) => symbols.includes(symbol.toUpperCase()),
    [symbols]
  );

  return { symbols, add, remove, has };
}

// Fetch on-demand analysis for arbitrary tickers (watchlist), refreshed
// every 5 minutes.
export function useAnalyzedPicks(symbols: string[]) {
  const [picks, setPicks] = useState<Record<string, StockPick>>({});
  const [failed, setFailed] = useState<string[]>([]);
  const key = symbols.join(",");

  useEffect(() => {
    if (!key) {
      setPicks({});
      setFailed([]);
      return;
    }
    let alive = true;
    const load = async () => {
      const results = await Promise.allSettled(
        key.split(",").map(async (s) => {
          const res = await fetch(`/api/analyze/${s}`);
          if (!res.ok) throw new Error(s);
          return (await res.json()) as StockPick;
        })
      );
      if (!alive) return;
      const next: Record<string, StockPick> = {};
      const bad: string[] = [];
      results.forEach((r, i) => {
        const sym = key.split(",")[i];
        if (r.status === "fulfilled") next[sym] = r.value;
        else bad.push(sym);
      });
      setPicks(next);
      setFailed(bad);
    };
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [key]);

  return { picks, failed };
}
