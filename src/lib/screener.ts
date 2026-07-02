import { analyzeSymbol } from "./analyze";
import { cached } from "./cache";
import type { ScreenResult, StockPick } from "./types";
import { fetchScreenerCandidates, type RawQuote } from "./yahoo";

// Small-cap band and liquidity filters for the Browse step
const MIN_MARKET_CAP = 50e6;
const MAX_MARKET_CAP = 2e9;
const MIN_PRICE = 0.5;
const MAX_PRICE = 100;
const MIN_REL_VOLUME = 1.5;
const ANALYZE_LIMIT = 25; // deep-analyze at most this many candidates
const INTRADAY_LIMIT = 12; // 15m refinement for the strongest ones only
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

// Full Browse -> Analyse -> Conclude pipeline.
export async function runScreen(): Promise<ScreenResult> {
  return cached("screen-result", 5 * 60_000, async () => {
    let { quotes: raw, live } = await fetchScreenerCandidates();
    if (!live) {
      const { sampleRawQuotes } = await import("./sample");
      raw = sampleRawQuotes();
    }

    // Browse: small caps only, with unusual buy volume and a green day
    const filtered = raw.filter((q) => {
      const cap = q.marketCap ?? 0;
      const price = q.regularMarketPrice ?? 0;
      const relVol =
        (q.regularMarketVolume ?? 0) /
        Math.max(q.averageDailyVolume3Month ?? 1, 1);
      return (
        q.quoteType !== "ETF" &&
        cap >= MIN_MARKET_CAP &&
        cap <= MAX_MARKET_CAP &&
        price >= MIN_PRICE &&
        price <= MAX_PRICE &&
        (q.regularMarketChangePercent ?? 0) > 0 &&
        relVol >= MIN_REL_VOLUME
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
      const results = await Promise.all(
        batch.map((q) => analyzeSymbol(q))
      );
      for (const r of results) if (r) daily.push(r);
      if (daily.length >= PICK_COUNT * 2) break;
    }
    daily.sort(rankPicks);

    // Analyse phase B: 15m entry refinement for the strongest candidates
    // (daily candles are already cached, so this only adds intraday calls)
    const top = daily.slice(0, INTRADAY_LIMIT);
    const refined: StockPick[] = [];
    for (let i = 0; i < top.length; i += BATCH) {
      const batch = top.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map((p) => analyzeSymbol(bySymbol.get(p.symbol)!, { intraday: true }))
      );
      results.forEach((r, j) => refined.push(r ?? batch[j]));
    }
    refined.sort(rankPicks);

    return {
      generatedAt: Date.now(),
      marketState: raw[0]?.marketState ?? "UNKNOWN",
      dataSource: live ? "live" : "sample",
      picks: refined.slice(0, PICK_COUNT),
    };
  });
}
