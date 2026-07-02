import { deriveLevels } from "./levels";
import { analyzeSmc } from "./smc";
import type { IntradayInfo, OrderBlock, StockPick } from "./types";
import { computeVolumeProfile } from "./volumeProfile";
import { fetchCandles, type RawQuote } from "./yahoo";

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
  if (pick.intraday?.refined) {
    parts.push(
      `ปรับจุดเข้าซื้อให้แม่นยำขึ้นจาก Order Block กราฟ 15 นาที ($${pick.intraday.orderBlockLow?.toFixed(2)}–$${pick.intraday.orderBlockHigh?.toFixed(2)})`
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

// Full single-symbol analysis: SMC structure + volume profile on daily
// candles, optionally refined with a 15m order block for the entry/SL.
export async function analyzeSymbol(
  q: RawQuote,
  opts: { intraday?: boolean } = {}
): Promise<StockPick | null> {
  const symbol = q.symbol;
  try {
    const candles = await fetchCandles(symbol, "1d");
    if (candles.length < 30) return null;

    const recent = candles.slice(-66); // ~3 months of trading days
    const smc = analyzeSmc(recent);
    const profile = computeVolumeProfile(recent);
    if (!smc || !profile) return null;

    const price = q.regularMarketPrice ?? recent[recent.length - 1].close;
    const recentHigh = Math.max(...recent.slice(-40).map((c) => c.high));

    // Optional intraday (15m) refinement of the buy zone
    let intraday: IntradayInfo | null = null;
    let intradayOb: OrderBlock | null = null;
    if (opts.intraday) {
      try {
        const intraCandles = await fetchCandles(symbol, "15m");
        const intraSmc = analyzeSmc(intraCandles.slice(-160));
        if (intraSmc) {
          intradayOb = intraSmc.orderBlock;
          intraday = {
            bullishBos: intraSmc.bullishBos,
            orderBlockHigh: intraSmc.orderBlock?.high ?? null,
            orderBlockLow: intraSmc.orderBlock?.low ?? null,
            refined: false, // set below from deriveLevels
          };
        }
      } catch {
        intraday = null;
      }
    }

    const { levels, refinedByIntraday } = deriveLevels(
      price,
      smc,
      profile,
      recentHigh,
      intradayOb
    );
    if (intraday) intraday.refined = refinedByIntraday;

    const relVolume =
      (q.regularMarketVolume ?? 0) /
      Math.max(q.averageDailyVolume3Month ?? 1, 1);

    // Score: high buy volume, confirmed bullish structure, price holding
    // above the point of control, and a nearby (fresh) entry zone
    let score = relVolume * 2 + (q.regularMarketChangePercent ?? 0) * 0.5;
    if (smc.bullishBos) score += 5;
    if (smc.orderBlock?.confirmed) score += 4;
    if (price >= profile.poc) score += 2;
    if (intraday?.bullishBos) score += 1;
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
      intraday,
      score: Number(score.toFixed(2)),
    };
    return { ...base, rationaleTh: buildRationaleTh(base) };
  } catch (err) {
    console.error(`analyze ${symbol} failed:`, err);
    return null;
  }
}
