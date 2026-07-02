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
}

export const SAMPLE_STOCKS: SampleStock[] = [
  { symbol: "SOUN", name: "SoundHound AI, Inc.", basePrice: 5.2, marketCap: 1.9e9 },
  { symbol: "BBAI", name: "BigBear.ai Holdings, Inc.", basePrice: 3.1, marketCap: 780e6 },
  { symbol: "EVGO", name: "EVgo, Inc.", basePrice: 4.4, marketCap: 1.3e9 },
  { symbol: "CHPT", name: "ChargePoint Holdings, Inc.", basePrice: 1.9, marketCap: 850e6 },
  { symbol: "LAZR", name: "Luminar Technologies, Inc.", basePrice: 3.8, marketCap: 420e6 },
  { symbol: "NNDM", name: "Nano Dimension Ltd.", basePrice: 2.4, marketCap: 520e6 },
  { symbol: "OPEN", name: "Opendoor Technologies Inc.", basePrice: 2.1, marketCap: 1.5e9 },
  { symbol: "DNA", name: "Ginkgo Bioworks Holdings", basePrice: 9.7, marketCap: 1.1e9 },
  { symbol: "KULR", name: "KULR Technology Group", basePrice: 1.6, marketCap: 390e6 },
  { symbol: "RGTI", name: "Rigetti Computing, Inc.", basePrice: 11.3, marketCap: 1.8e9 },
  { symbol: "QUBT", name: "Quantum Computing Inc.", basePrice: 7.9, marketCap: 990e6 },
  { symbol: "ACHR", name: "Archer Aviation Inc.", basePrice: 8.6, marketCap: 1.95e9 },
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

export function sampleCandles(symbol: string, days = 130): Candle[] {
  const stock = SAMPLE_STOCKS.find((s) => s.symbol === symbol);
  const base = stock?.basePrice ?? 5;
  const rand = mulberry32(hashSymbol(symbol));
  const candles: Candle[] = [];

  const now = Math.floor(Date.now() / 1000);
  const daySec = 24 * 3600;
  let price = base * 1.15;
  const baseVolume = 2e6 + rand() * 6e6;

  for (let i = 0; i < days; i++) {
    const time = now - (days - i) * daySec;
    // Phases: drift down -> accumulate -> impulse up -> pullback -> resume
    const p = i / days;
    let drift: number;
    let volMult = 0.8 + rand() * 0.5;
    if (p < 0.35) {
      drift = -0.004;
    } else if (p < 0.72) {
      drift = 0.0005; // accumulation range
    } else if (p < 0.82) {
      drift = 0.035; // high-volume bullish impulse (BOS)
      volMult = 2.5 + rand() * 1.8;
    } else if (p < 0.9) {
      drift = -0.008; // pullback toward the order block
      volMult = 1.1 + rand() * 0.4;
    } else {
      drift = 0.012; // rebound continuation
      volMult = 1.5 + rand() * 0.8;
    }

    const noise = (rand() - 0.5) * 0.03;
    const open = price;
    const close = Math.max(0.3, open * (1 + drift + noise));
    const high = Math.max(open, close) * (1 + rand() * 0.015);
    const low = Math.min(open, close) * (1 - rand() * 0.015);
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
      marketState: "DEMO",
      quoteType: "EQUITY",
    };
  });
}

export function sampleQuote(symbol: string): Quote {
  const q =
    sampleRawQuotes().find((s) => s.symbol === symbol) ?? sampleRawQuotes()[0];
  return {
    symbol,
    price: q.regularMarketPrice ?? 0,
    preMarketPrice: q.preMarketPrice ?? null,
    postMarketPrice: null,
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
