import type { Levels, SmcAnalysis, VolumeProfile } from "./types";

// Combine SMC structure and the volume profile into trading levels:
//   entry = top of the bullish order block (pullback buy zone)
//   stopLoss = just below the order block low
//   high = recent structural high (resistance)
//   takeProfit = conservative target below the high, capped at the
//                value area high when the profile sits below it
//   mid = midpoint of entry->high, the "average" of the move
export function deriveLevels(
  price: number,
  smc: SmcAnalysis,
  profile: VolumeProfile | null,
  recentHigh: number
): Levels {
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
  // The buy zone must sit at or below current price
  entry = Math.min(entry, price);
  stopLoss = Math.min(stopLoss, entry * 0.97);

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
    high: round(high),
    takeProfit: round(takeProfit),
    mid: round(mid),
    entry: round(entry),
    stopLoss: round(stopLoss),
  };
}
