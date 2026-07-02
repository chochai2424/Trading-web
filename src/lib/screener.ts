import { cached } from "./cache";
import { deriveLevels } from "./levels";
import { analyzeSmc } from "./smc";
import type { ScreenResult, StockPick } from "./types";
import { computeVolumeProfile } from "./volumeProfile";
import {
  fetchDailyCandles,
  fetchScreenerCandidates,
  type RawQuote,
} from "./yahoo";

// Small-cap band and liquidity filters for the Browse step
const MIN_MARKET_CAP = 50e6;
const MAX_MARKET_CAP = 2e9;
const MIN_PRICE = 0.5;
const MAX_PRICE = 100;
const MIN_REL_VOLUME = 1.5;
const ANALYZE_LIMIT = 25; // deep-analyze at most this many candidates
const PICK_COUNT = 10;

function candidateScore(q: RawQuote): number {
  const relVol =
    (q.regularMarketVolume ?? 0) / Math.max(q.averageDailyVolume3Month ?? 1, 1);
  return relVol * 2 + (q.regularMarketChangePercent ?? 0);
}

function buildRationaleTh(pick: Omit<StockPick, "rationaleTh">): string {
  const parts: string[] = [];
  if (pick.smc.bullishBos) {
    parts.push("เกิด Break of Structure (BOS) ขาขึ้น ยืนยันแนวโน้มกระทิง");
  } else {
    parts.push("ราคากำลังรีบาวด์เข้าใกล้แนวต้านโครงสร้างเดิม");
  }
  if (pick.smc.orderBlockHigh != null) {
    parts.push(
      `พบ Order Block ฝั่งซื้อที่โซน $${pick.smc.orderBlockLow?.toFixed(2)}–$${pick.smc.orderBlockHigh.toFixed(2)} ใช้เป็นจุดเข้าซื้อเมื่อราคาย่อตัว`
    );
  }
  parts.push(
    `วอลุ่มซื้อสูงกว่าค่าเฉลี่ย ${pick.relVolume.toFixed(1)} เท่า ดันราคาขึ้น ${pick.changePercent.toFixed(1)}%`
  );
  parts.push(
    `Volume Profile: POC ที่ $${pick.volumeProfile.poc.toFixed(2)} ราคา${
      pick.price >= pick.volumeProfile.poc ? "ยืนเหนือ" : "อยู่ใต้"
    } POC, Value Area $${pick.volumeProfile.val.toFixed(2)}–$${pick.volumeProfile.vah.toFixed(2)}`
  );
  return parts.join(" • ");
}

async function analyzeCandidate(q: RawQuote): Promise<StockPick | null> {
  const symbol = q.symbol;
  try {
    const candles = await fetchDailyCandles(symbol);
    if (candles.length < 30) return null;

    // Analyse step: SMC structure + volume profile on ~3 months of data
    const recent = candles.slice(-66);
    const smc = analyzeSmc(recent);
    const profile = computeVolumeProfile(recent);
    if (!smc || !profile) return null;

    const price = q.regularMarketPrice ?? recent[recent.length - 1].close;
    const recentHigh = Math.max(...recent.slice(-40).map((c) => c.high));
    const levels = deriveLevels(price, smc, profile, recentHigh);

    const relVolume =
      (q.regularMarketVolume ?? 0) /
      Math.max(q.averageDailyVolume3Month ?? 1, 1);

    // Score: high buy volume, confirmed bullish structure, price holding
    // above the point of control, and a nearby (fresh) entry zone
    let score = relVolume * 2 + (q.regularMarketChangePercent ?? 0) * 0.5;
    if (smc.bullishBos) score += 5;
    if (smc.orderBlock?.confirmed) score += 4;
    if (price >= profile.poc) score += 2;
    const entryDistance = (price - levels.entry) / price;
    score += Math.max(0, 3 - entryDistance * 20); // closer entry = better

    const base: Omit<StockPick, "rationaleTh"> = {
      symbol,
      name: q.shortName || q.longName || symbol,
      price,
      preMarketPrice: q.preMarketPrice ?? null,
      changePercent: q.regularMarketChangePercent ?? 0,
      marketCap: q.marketCap ?? 0,
      volume: q.regularMarketVolume ?? 0,
      avgVolume: q.averageDailyVolume3Month ?? 0,
      relVolume,
      levels,
      volumeProfile: {
        poc: Number(profile.poc.toFixed(2)),
        vah: Number(profile.vah.toFixed(2)),
        val: Number(profile.val.toFixed(2)),
      },
      smc: {
        bullishBos: smc.bullishBos,
        orderBlockHigh: smc.orderBlock?.high ?? null,
        orderBlockLow: smc.orderBlock?.low ?? null,
        impulseRelVolume: Number(smc.impulseRelVolume.toFixed(2)),
      },
      score: Number(score.toFixed(2)),
    };
    return { ...base, rationaleTh: buildRationaleTh(base) };
  } catch (err) {
    console.error(`analyze ${symbol} failed:`, err);
    return null;
  }
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

    // Analyse (in small parallel batches to be kind to the API)
    const analyzed: StockPick[] = [];
    const BATCH = 5;
    for (let i = 0; i < candidates.length; i += BATCH) {
      const batch = candidates.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(analyzeCandidate));
      for (const r of results) if (r) analyzed.push(r);
      if (analyzed.length >= PICK_COUNT * 2) break;
    }

    // Conclude: prefer confirmed bullish structure, then score
    analyzed.sort((a, b) => {
      if (a.smc.bullishBos !== b.smc.bullishBos) {
        return a.smc.bullishBos ? -1 : 1;
      }
      return b.score - a.score;
    });

    return {
      generatedAt: Date.now(),
      marketState: raw[0]?.marketState ?? "UNKNOWN",
      dataSource: live ? "live" : "sample",
      picks: analyzed.slice(0, PICK_COUNT),
    };
  });
}
