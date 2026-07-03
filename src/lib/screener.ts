import { analyzeSymbol } from "./analyze";
import { cached } from "./cache";
import { tradingDayKey } from "./marketHours";
import type { ScreenResult, StockPick } from "./types";
import {
  fetchQuote,
  fetchScreenerCandidates,
  type RawQuote,
} from "./yahoo";

// Universe filters for the Browse step. All cap tiers (mega -> small)
// across US exchanges; unusual buy volume required, with a lower bar
// for big caps where 1.5x average volume is rare.
const MIN_MARKET_CAP = 50e6;
const MIN_PRICE = 0.5;
const MIN_REL_VOLUME_SMALL = 1.5; // cap < $10B
const MIN_REL_VOLUME_BIG = 1.2; // cap >= $10B
const ANALYZE_LIMIT = 30; // deep-analyze at most this many candidates
const INTRADAY_LIMIT = 12; // 15m + fundamentals for the strongest only
const PICK_COUNT = 10;

function candidateScore(q: RawQuote): number {
  const relVol =
    (q.regularMarketVolume ?? 0) / Math.max(q.averageDailyVolume3Month ?? 1, 1);
  return relVol * 2 + (q.regularMarketChangePercent ?? 0);
}

function rankPicks(a: StockPick, b: StockPick): number {
  // Prefer confirmed bullish structure, then score
  if (a.smc.bullishBos !== b.smc.bullishBos) {
    return a.smc.bullishBos ? -1 : 1;
  }
  return b.score - a.score;
}

// Full Browse -> Analyse -> Conclude pipeline. Runs once per trading
// day: the cache key rolls over at pre-market open (04:00 ET), so the
// first request after that rebuilds the list — dropping tickers whose
// SMC setup decayed and admitting candidates now closer to condition.
async function buildScreen(): Promise<ScreenResult> {
  let { quotes: raw, live } = await fetchScreenerCandidates();
  if (!live) {
    const { sampleRawQuotes } = await import("./sample");
    raw = sampleRawQuotes();
  }

  // Browse: all caps, green day, unusual buy volume
  const filtered = raw.filter((q) => {
    const cap = q.marketCap ?? 0;
    const price = q.regularMarketPrice ?? 0;
    const relVol =
      (q.regularMarketVolume ?? 0) /
      Math.max(q.averageDailyVolume3Month ?? 1, 1);
    const minRelVol =
      cap >= 10e9 ? MIN_REL_VOLUME_BIG : MIN_REL_VOLUME_SMALL;
    return (
      q.quoteType !== "ETF" &&
      cap >= MIN_MARKET_CAP &&
      price >= MIN_PRICE &&
      (q.regularMarketChangePercent ?? 0) > 0 &&
      relVol >= minRelVol
    );
  });

  filtered.sort((a, b) => candidateScore(b) - candidateScore(a));
  const candidates = filtered.slice(0, ANALYZE_LIMIT);
  const bySymbol = new Map(candidates.map((q) => [q.symbol, q]));

  // Analyse phase A: daily structure for all candidates (small
  // parallel batches to be kind to the API)
  const daily: StockPick[] = [];
  const BATCH = 5;
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((q) => analyzeSymbol(q)));
    for (const r of results) if (r) daily.push(r);
    if (daily.length >= PICK_COUNT * 2) break;
  }
  daily.sort(rankPicks);

  // Analyse phase B: 15m entry refinement + sector/profitability
  // fundamentals for the strongest candidates (daily candles are
  // already cached, so this adds only the intraday/profile calls)
  const top = daily.slice(0, INTRADAY_LIMIT);
  const refined: StockPick[] = [];
  for (let i = 0; i < top.length; i += BATCH) {
    const batch = top.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map((p) =>
        analyzeSymbol(bySymbol.get(p.symbol)!, {
          intraday: true,
          profile: true,
        })
      )
    );
    results.forEach((r, j) => refined.push(r ?? batch[j]));
  }
  refined.sort(rankPicks);

  return {
    generatedAt: Date.now(),
    tradingDay: tradingDayKey(),
    marketState: raw[0]?.marketState ?? "UNKNOWN",
    dataSource: live ? "live" : "sample",
    picks: refined.slice(0, PICK_COUNT),
  };
}

// Refresh each pick with a live quote so /api/screen always carries
// current prices (pre/regular/after-market) and an up-to-date SMC
// validity flag, even though the pick list itself is daily.
async function withLiveQuotes(result: ScreenResult): Promise<ScreenResult> {
  const picks = await Promise.all(
    result.picks.map(async (p) => {
      try {
        const q = await fetchQuote(p.symbol);
        const price = q.price || p.price;
        return {
          ...p,
          price,
          preMarketPrice: q.preMarketPrice ?? p.preMarketPrice,
          postMarketPrice: q.postMarketPrice ?? p.postMarketPrice,
          changePercent: q.changePercent ?? p.changePercent,
          smcValid: price > p.levels.stopLoss,
        };
      } catch {
        return p;
      }
    })
  );
  return { ...result, picks };
}

export async function runScreen(force = false): Promise<ScreenResult> {
  const key = `screen:${tradingDayKey()}`;
  const result = await cached(key, 24 * 3600_000, buildScreen, { force });
  return withLiveQuotes(result);
}
