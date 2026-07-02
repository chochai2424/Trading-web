import yahooFinance from "yahoo-finance2";
import { ProxyAgent, setGlobalDispatcher } from "undici";
import { cached } from "./cache";
import type { Candle, NewsItem, Quote } from "./types";

// Node's built-in fetch does not honor HTTPS_PROXY. When a proxy is
// configured (e.g. corporate/CI environments), route all outbound
// requests through it. No-op otherwise.
const proxyUrl =
  process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY;
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

export interface RawQuote {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  averageDailyVolume3Month?: number;
  averageDailyVolume10Day?: number;
  marketCap?: number;
  preMarketPrice?: number;
  postMarketPrice?: number;
  marketState?: string;
  fiftyTwoWeekHigh?: number;
  exchange?: string;
  quoteType?: string;
}

const SCREENER_IDS = [
  "small_cap_gainers",
  "day_gainers",
  "aggressive_small_caps",
  "most_actives",
] as const;

// Browse step: pull candidate symbols from Yahoo's predefined screeners.
// Returns live=false when Yahoo is unreachable so callers can fall back
// to sample data.
export async function fetchScreenerCandidates(): Promise<{
  quotes: RawQuote[];
  live: boolean;
}> {
  return cached("screener-candidates", 5 * 60_000, async () => {
    const bySymbol = new Map<string, RawQuote>();
    for (const scrId of SCREENER_IDS) {
      try {
        const res = await yahooFinance.screener(
          { scrIds: scrId, count: 100 },
          { validateResult: false }
        );
        for (const q of (res?.quotes ?? []) as RawQuote[]) {
          if (q?.symbol && !bySymbol.has(q.symbol)) bySymbol.set(q.symbol, q);
        }
      } catch (err) {
        console.error(`screener ${scrId} failed:`, (err as Error).message);
      }
    }
    return { quotes: Array.from(bySymbol.values()), live: bySymbol.size > 0 };
  });
}

export async function fetchQuote(symbol: string): Promise<Quote> {
  return cached(`quote:${symbol}`, 10_000, async () => {
    try {
      const q = (await yahooFinance.quote(symbol)) as RawQuote;
      return {
        symbol,
        price: q.regularMarketPrice ?? 0,
        preMarketPrice: q.preMarketPrice ?? null,
        postMarketPrice: q.postMarketPrice ?? null,
        changePercent: q.regularMarketChangePercent ?? 0,
        marketState: q.marketState ?? "UNKNOWN",
        updatedAt: Date.now(),
      };
    } catch (err) {
      console.error(`quote ${symbol} failed:`, (err as Error).message);
      const { sampleQuote } = await import("./sample");
      return sampleQuote(symbol);
    }
  });
}

// Daily candles for structure analysis (~6 months).
export async function fetchDailyCandles(symbol: string): Promise<Candle[]> {
  return cached(`daily:${symbol}`, 2 * 60_000, async () => {
    try {
      const period1 = new Date(Date.now() - 185 * 24 * 3600_000);
      const res = await yahooFinance.chart(symbol, {
        period1,
        interval: "1d",
      });
      const candles: Candle[] = [];
      for (const q of res.quotes ?? []) {
        if (
          q.open == null ||
          q.high == null ||
          q.low == null ||
          q.close == null
        )
          continue;
        candles.push({
          time: Math.floor(new Date(q.date).getTime() / 1000),
          open: q.open,
          high: q.high,
          low: q.low,
          close: q.close,
          volume: q.volume ?? 0,
        });
      }
      if (candles.length === 0) throw new Error("empty chart response");
      return candles;
    } catch (err) {
      console.error(`chart ${symbol} failed:`, (err as Error).message);
      const { sampleCandles } = await import("./sample");
      return sampleCandles(symbol);
    }
  });
}

export async function fetchNews(symbol: string): Promise<NewsItem[]> {
  return cached(`news:${symbol}`, 5 * 60_000, async () => {
    try {
      const res = await yahooFinance.search(
        symbol,
        { newsCount: 12, quotesCount: 0 },
        { validateResult: false }
      );
      interface RawNews {
        title: string;
        publisher: string;
        link: string;
        providerPublishTime?: string | number | Date;
        thumbnail?: { resolutions?: { url: string }[] };
      }
      const items = ((res.news ?? []) as RawNews[]).map((n) => ({
        title: n.title,
        publisher: n.publisher,
        link: n.link,
        publishedAt: n.providerPublishTime
          ? new Date(n.providerPublishTime).getTime()
          : Date.now(),
        thumbnail: n.thumbnail?.resolutions?.[0]?.url ?? null,
      }));
      if (items.length === 0) throw new Error("no news returned");
      return items;
    } catch (err) {
      console.error(`news ${symbol} failed:`, (err as Error).message);
      const { sampleNews } = await import("./sample");
      return sampleNews(symbol);
    }
  });
}
