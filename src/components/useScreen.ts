"use client";

import { useEffect, useState } from "react";
import type { Quote, ScreenResult } from "@/lib/types";

// Load the screening result once, then re-check every 5 minutes
// (matches the server-side cache TTL).
export function useScreen() {
  const [data, setData] = useState<ScreenResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/screen");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ScreenResult;
        if (alive) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(String(e));
      }
    };
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return { data, error };
}

// Poll live quotes: every 10 s while the market is in regular session
// (real-time trading), 15 s otherwise (pre/after-market, closed).
export function useQuotes(symbols: string[]) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const key = symbols.join(",");

  useEffect(() => {
    if (!key) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      const results = await Promise.allSettled(
        key.split(",").map(async (s) => {
          const res = await fetch(`/api/quote/${s}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return (await res.json()) as Quote;
        })
      );
      if (!alive) return;
      let regular = false;
      setQuotes((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r.status === "fulfilled") {
            next[r.value.symbol] = r.value;
            if (r.value.marketState === "REGULAR") regular = true;
          }
        }
        return next;
      });
      timer = setTimeout(load, regular ? 10_000 : 15_000);
    };

    load();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [key]);

  return quotes;
}
