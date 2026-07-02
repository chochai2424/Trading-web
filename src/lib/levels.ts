import type {
  Levels,
  OrderBlock,
  SmcAnalysis,
  VolumeProfile,
} from "./types";

// Combine SMC structure and the volume profile into trading levels:
//   entry = top of the bullish order block (pullback buy zone)
//   stopLoss = just below the order block low
//   high = recent structural high (resistance)
//   takeProfit = conservative target below the high, capped at the
//                value area high when the profile sits below it
//   mid = midpoint of entry->high, the "average" of the move
// When a bullish 15m order block sits inside the daily buy zone, the
// entry/SL are tightened to it (intraday refinement).
export function deriveLevels(
  price: number,
  smc: SmcAnalysis,
  profile: VolumeProfile | null,
  recentHigh: number,
  intradayOb?: OrderBlock | null
): { levels: Levels; refinedByIntraday: boolean } {
  const high = Math.max(recentHigh, smc.swingHigh, price);

  let entry: number;
  let stopLoss: number;
  if (smc.orderBlock) {
    entry = smc.orderBlock.high;
    stopLoss = smc.orderBlock.low * 0.99;
  } else {
    // Fallback: value area low or recent swing low as the demand zone
    entry = profile ? Math.min(profile.val, price) : smc.swingLow;
    stopLoss = smc.swingLow * 0.99;
  }

  // Intraday refinement: a fresh 15m order block below current price and
  // above the daily invalidation level gives a more precise entry
  let refinedByIntraday = false;
  if (
    intradayOb &&
    intradayOb.high <= price &&
    intradayOb.high > stopLoss &&
    intradayOb.low > stopLoss * 0.98
  ) {
    entry = intradayOb.high;
    stopLoss = Math.max(stopLoss, intradayOb.low * 0.995);
    refinedByIntraday = true;
  }

  // The buy zone must sit at or below current price; SL stays below the
  // entry (a tighter margin is allowed for a refined intraday stop)
  entry = Math.min(entry, price);
  stopLoss = Math.min(stopLoss, entry * (refinedByIntraday ? 0.995 : 0.97));

  // Conservative take profit: 78.6% of the entry->high range, and if the
  // value area high sits between entry and the high, don't target past it.
  let takeProfit = entry + (high - entry) * 0.786;
  if (profile && profile.vah > entry * 1.01 && profile.vah < high) {
    takeProfit = Math.min(takeProfit, profile.vah);
  }
  takeProfit = Math.max(takeProfit, entry * 1.01);

  let mid = (entry + high) / 2;
  // Keep ordering sane: entry < mid < takeProfit <= high
  mid = Math.min(Math.max(mid, entry * 1.005), takeProfit * 0.995);

  const round = (v: number) => Number(v.toFixed(v < 1 ? 4 : 2));
  return {
    levels: {
      high: round(high),
      takeProfit: round(takeProfit),
      mid: round(mid),
      entry: round(entry),
      stopLoss: round(stopLoss),
    },
    refinedByIntraday,
  };
}
