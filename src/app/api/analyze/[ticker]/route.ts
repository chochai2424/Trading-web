import { NextResponse } from "next/server";
import yahooFinance from "yahoo-finance2";
import { analyzeSymbol } from "@/lib/analyze";
import { cached } from "@/lib/cache";
import type { RawQuote } from "@/lib/yahoo";

export const dynamic = "force-dynamic";

// On-demand SMC + volume-profile analysis for any ticker (watchlist).
export async function GET(
  _req: Request,
  { params }: { params: { ticker: string } }
) {
  const symbol = params.ticker.toUpperCase();
  try {
    const pick = await cached(`analyze:${symbol}`, 60_000, async () => {
      let quote: RawQuote;
      try {
        quote = (await yahooFinance.quote(symbol)) as RawQuote;
      } catch {
        const { sampleRawQuotes, SAMPLE_STOCKS, sampleCandles } = await import(
          "@/lib/sample"
        );
        const known = sampleRawQuotes().find((q) => q.symbol === symbol);
        if (known) {
          quote = known;
        } else {
          // Unknown ticker in sample mode: synthesize a quote from
          // generated candles so the analysis still demonstrates
          const candles = sampleCandles(symbol);
          const last = candles[candles.length - 1];
          const prev = candles[candles.length - 2];
          quote = {
            symbol,
            shortName: symbol,
            regularMarketPrice: last.close,
            regularMarketChangePercent:
              ((last.close - prev.close) / prev.close) * 100,
            regularMarketVolume: last.volume,
            averageDailyVolume3Month: Math.round(last.volume / 2),
            marketCap: SAMPLE_STOCKS[0].marketCap,
            marketState: "DEMO",
            quoteType: "EQUITY",
          };
        }
      }
      return analyzeSymbol(quote, { intraday: true });
    });

    if (!pick) {
      return NextResponse.json(
        { error: "not enough data to analyze this ticker" },
        { status: 422 }
      );
    }
    return NextResponse.json(pick);
  } catch (err) {
    console.error(`analyze ${symbol} failed:`, err);
    return NextResponse.json({ error: "analyze failed" }, { status: 500 });
  }
}
