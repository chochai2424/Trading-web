import type { Candle, NewsItem, Quote } from "./types";
import type { RawQuote } from "./yahoo";

// Sample-data fallback: used only when Yahoo Finance is unreachable
// (offline dev, restricted networks). Candles are generated with a
// seeded PRNG shaped like the setup we screen for — accumulation,
// high-volume bullish impulse breaking structure, then a pullback —
// so the real SMC / volume-profile pipeline still runs on them.

interface SampleStock {
  symbol: string;
  name: string;
  basePrice: number;
  marketCap: number;
  sector: string;
  industry: string;
  trailingEps: number;
  forwardEps: number;
  profitMargin: number;
  revenueGrowth: number;
}

// Mixed cap tiers (mega -> small) so tier chips / badges render in demo
// mode; several are "nearly profitable" (trailing EPS < 0, forward >= 0)
export const SAMPLE_STOCKS: SampleStock[] = [
  { symbol: "NVDA", name: "NVIDIA Corporation", basePrice: 172, marketCap: 4.2e12, sector: "Technology", industry: "Semiconductors", trailingEps: 3.1, forwardEps: 4.5, profitMargin: 0.52, revenueGrowth: 0.6 },
  { symbol: "AMD", name: "Advanced Micro Devices", basePrice: 158, marketCap: 250e9, sector: "Technology", industry: "Semiconductors", trailingEps: 2.2, forwardEps: 4.1, profitMargin: 0.08, revenueGrowth: 0.2 },
  { symbol: "SNOW", name: "Snowflake Inc.", basePrice: 210, marketCap: 70e9, sector: "Technology", industry: "Software - Infrastructure", trailingEps: -2.6, forwardEps: 1.2, profitMargin: -0.28, revenueGrowth: 0.28 },
  { symbol: "IONQ", name: "IonQ, Inc.", basePrice: 38, marketCap: 9.5e9, sector: "Technology", industry: "Computer Hardware", trailingEps: -1.1, forwardEps: 0.05, profitMargin: -0.9, revenueGrowth: 0.8 },
  { symbol: "SOFI", name: "SoFi Technologies, Inc.", basePrice: 15.5, marketCap: 16e9, sector: "Financial Services", industry: "Credit Services", trailingEps: 0.1, forwardEps: 0.35, profitMargin: 0.04, revenueGrowth: 0.25 },
  { symbol: "SOUN", name: "SoundHound AI, Inc.", basePrice: 5.2, marketCap: 1.9e9, sector: "Technology", industry: "Software - Application", trailingEps: -0.4, forwardEps: 0.02, profitMargin: -0.12, revenueGrowth: 0.5 },
  { symbol: "BBAI", name: "BigBear.ai Holdings, Inc.", basePrice: 3.1, marketCap: 780e6, sector: "Technology", industry: "Information Technology Services", trailingEps: -0.6, forwardEps: -0.1, profitMargin: -0.35, revenueGrowth: 0.1 },
  { symbol: "EVGO", name: "EVgo, Inc.", basePrice: 4.4, marketCap: 1.3e9, sector: "Consumer Cyclical", industry: "Specialty Retail", trailingEps: -0.3, forwardEps: 0.01, profitMargin: -0.1, revenueGrowth: 0.3 },
  { symbol: "CHPT", name: "ChargePoint Holdings, Inc.", basePrice: 1.9, marketCap: 850e6, sector: "Technology", industry: "Electrical Equipment", trailingEps: -0.5, forwardEps: -0.2, profitMargin: -0.4, revenueGrowth: -0.05 },
  { symbol: "LAZR", name: "Luminar Technologies, Inc.", basePrice: 3.8, marketCap: 420e6, sector: "Technology", industry: "Auto Parts", trailingEps: -3.2, forwardEps: -1.5, profitMargin: -1.5, revenueGrowth: 0.15 },
  { symbol: "NNDM", name: "Nano Dimension Ltd.", basePrice: 2.4, marketCap: 520e6, sector: "Technology", industry: "Computer Hardware", trailingEps: -0.4, forwardEps: -0.1, profitMargin: -0.6, revenueGrowth: 0.05 },
  { symbol: "OPEN", name: "Opendoor Technologies Inc.", basePrice: 2.1, marketCap: 1.5e9, sector: "Real Estate", industry: "Real Estate Services", trailingEps: -0.5, forwardEps: 0.03, profitMargin: -0.06, revenueGrowth: 0.12 },
  { symbol: "DNA", name: "Ginkgo Bioworks Holdings", basePrice: 9.7, marketCap: 1.1e9, sector: "Healthcare", industry: "Biotechnology", trailingEps: -4.1, forwardEps: -1.2, profitMargin: -1.8, revenueGrowth: 0.02 },
  { symbol: "KULR", name: "KULR Technology Group", basePrice: 1.6, marketCap: 390e6, sector: "Technology", industry: "Electronic Components", trailingEps: -0.1, forwardEps: 0.01, profitMargin: -0.08, revenueGrowth: 0.4 },
  { symbol: "RGTI", name: "Rigetti Computing, Inc.", basePrice: 11.3, marketCap: 1.8e9, sector: "Technology", industry: "Computer Hardware", trailingEps: -0.3, forwardEps: 0.02, profitMargin: -0.7, revenueGrowth: 0.35 },
  { symbol: "QUBT", name: "Quantum Computing Inc.", basePrice: 7.9, marketCap: 990e6, sector: "Technology", industry: "Computer Hardware", trailingEps: -0.25, forwardEps: -0.05, profitMargin: -0.9, revenueGrowth: 0.5 },
  { symbol: "ACHR", name: "Archer Aviation Inc.", basePrice: 8.6, marketCap: 1.95e9, sector: "Industrials", industry: "Aerospace & Defense", trailingEps: -1.2, forwardEps: -0.6, profitMargin: -2.0, revenueGrowth: 0.9 },
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSymbol(symbol: string): number {
  let h = 2166136261;
  for (let i = 0; i < symbol.length; i++) {
    h ^= symbol.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function sampleCandles(
  symbol: string,
  interval: "1d" | "15m" = "1d"
): Candle[] {
  const stock = SAMPLE_STOCKS.find((s) => s.symbol === symbol);
  const base = stock?.basePrice ?? 5;
  const intraday = interval === "15m";
  const bars = intraday ? 260 : 130; // ~10 trading days of 15m bars
  const rand = mulberry32(hashSymbol(symbol) ^ (intraday ? 0x15a : 0));
  const candles: Candle[] = [];

  const now = Math.floor(Date.now() / 1000);
  const stepSec = intraday ? 900 : 24 * 3600;
  // Intraday moves are smaller per bar than daily moves
  const scale = intraday ? 0.3 : 1;
  let price = base * (intraday ? 1.0 : 1.15);
  const baseVolume = (intraday ? 1e5 : 2e6) + rand() * (intraday ? 3e5 : 6e6);

  for (let i = 0; i < bars; i++) {
    const time = now - (bars - i) * stepSec;
    // Phases: drift down -> accumulate -> impulse up -> pullback -> resume
    const p = i / bars;
    let drift: number;
    let volMult = 0.8 + rand() * 0.5;
    if (p < 0.35) {
      drift = -0.004 * scale;
    } else if (p < 0.72) {
      drift = 0.0005 * scale; // accumulation range
    } else if (p < 0.82) {
      drift = 0.035 * scale; // high-volume bullish impulse (BOS)
      volMult = 2.5 + rand() * 1.8;
    } else if (p < 0.9) {
      drift = -0.008 * scale; // pullback toward the order block
      volMult = 1.1 + rand() * 0.4;
    } else {
      drift = 0.012 * scale; // rebound continuation
      volMult = 1.5 + rand() * 0.8;
    }

    const noise = (rand() - 0.5) * 0.03 * scale;
    const open = price;
    const close = Math.max(0.3, open * (1 + drift + noise));
    const high = Math.max(open, close) * (1 + rand() * 0.015 * scale);
    const low = Math.min(open, close) * (1 - rand() * 0.015 * scale);
    candles.push({
      time,
      open: Number(open.toFixed(4)),
      high: Number(high.toFixed(4)),
      low: Number(low.toFixed(4)),
      close: Number(close.toFixed(4)),
      volume: Math.round(baseVolume * volMult),
    });
    price = close;
  }

  // Align the intraday series to end at the daily close so both
  // timeframes tell one consistent price story
  if (intraday) {
    const dailyClose = sampleCandles(symbol, "1d").at(-1)!.close;
    const factor = dailyClose / candles[candles.length - 1].close;
    for (const c of candles) {
      c.open = Number((c.open * factor).toFixed(4));
      c.high = Number((c.high * factor).toFixed(4));
      c.low = Number((c.low * factor).toFixed(4));
      c.close = Number((c.close * factor).toFixed(4));
    }
  }
  return candles;
}

export function sampleRawQuotes(): RawQuote[] {
  return SAMPLE_STOCKS.map((s) => {
    const candles = sampleCandles(s.symbol);
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const rand = mulberry32(hashSymbol(s.symbol) ^ 0xbeef);
    return {
      symbol: s.symbol,
      shortName: s.name,
      regularMarketPrice: last.close,
      regularMarketChangePercent:
        ((last.close - prev.close) / prev.close) * 100,
      regularMarketVolume: last.volume,
      averageDailyVolume3Month: Math.round(last.volume / (1.8 + rand() * 1.5)),
      marketCap: s.marketCap,
      preMarketPrice: Number((last.close * (1 + (rand() - 0.4) * 0.02)).toFixed(4)),
      postMarketPrice: Number((last.close * (1 + (rand() - 0.5) * 0.015)).toFixed(4)),
      marketState: "DEMO",
      quoteType: "EQUITY",
    };
  });
}

export function sampleProfile(symbol: string) {
  const s = SAMPLE_STOCKS.find((x) => x.symbol === symbol);
  return {
    sector: s?.sector ?? null,
    industry: s?.industry ?? null,
    trailingEps: s?.trailingEps ?? null,
    forwardEps: s?.forwardEps ?? null,
    profitMargin: s?.profitMargin ?? null,
    revenueGrowth: s?.revenueGrowth ?? null,
  };
}

export function sampleQuote(symbol: string): Quote {
  const q =
    sampleRawQuotes().find((s) => s.symbol === symbol) ?? sampleRawQuotes()[0];
  return {
    symbol,
    price: q.regularMarketPrice ?? 0,
    preMarketPrice: q.preMarketPrice ?? null,
    postMarketPrice: q.postMarketPrice ?? null,
    changePercent: q.regularMarketChangePercent ?? 0,
    marketState: "DEMO",
    updatedAt: Date.now(),
  };
}

export function sampleNews(symbol: string): NewsItem[] {
  const link = `https://finance.yahoo.com/quote/${symbol}/news`;
  return [
    {
      title: `[ข้อมูลตัวอย่าง] ${symbol} ปรับตัวขึ้นแรงพร้อมวอลุ่มซื้อผิดปกติ`,
      publisher: "Sample Wire",
      link,
      publishedAt: Date.now() - 2 * 3600_000,
      thumbnail: null,
    },
    {
      title: `[ข้อมูลตัวอย่าง] นักวิเคราะห์จับตา ${symbol} หลังราคาทะลุแนวต้านสำคัญ`,
      publisher: "Sample Wire",
      link,
      publishedAt: Date.now() - 8 * 3600_000,
      thumbnail: null,
    },
    {
      title: `[ข้อมูลตัวอย่าง] เชื่อมต่อ Yahoo Finance ไม่ได้ — ระบบกำลังแสดงข่าวตัวอย่าง`,
      publisher: "System",
      link,
      publishedAt: Date.now() - 24 * 3600_000,
      thumbnail: null,
    },
  ];
}
