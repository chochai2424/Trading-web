import type { Candle, VolumeProfile } from "./types";

const BIN_COUNT = 24;
const VALUE_AREA = 0.7; // standard 70% value area

// Build a volume-by-price histogram: each candle's volume is spread
// proportionally across the price bins its high-low range overlaps.
export function computeVolumeProfile(candles: Candle[]): VolumeProfile | null {
  if (candles.length < 10) return null;

  const min = Math.min(...candles.map((c) => c.low));
  const max = Math.max(...candles.map((c) => c.high));
  if (!(max > min)) return null;

  const binSize = (max - min) / BIN_COUNT;
  const volumes = new Array<number>(BIN_COUNT).fill(0);

  for (const c of candles) {
    const range = Math.max(c.high - c.low, binSize / 100);
    const lo = Math.max(0, Math.floor((c.low - min) / binSize));
    const hi = Math.min(BIN_COUNT - 1, Math.floor((c.high - min) / binSize));
    for (let i = lo; i <= hi; i++) {
      const binLow = min + i * binSize;
      const binHigh = binLow + binSize;
      const overlap =
        Math.min(c.high, binHigh) - Math.max(c.low, binLow);
      volumes[i] += c.volume * Math.max(overlap, 0) / range;
    }
  }

  const total = volumes.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;

  let pocIdx = 0;
  for (let i = 1; i < BIN_COUNT; i++) {
    if (volumes[i] > volumes[pocIdx]) pocIdx = i;
  }

  // Expand from POC outward until the value area holds 70% of volume
  let covered = volumes[pocIdx];
  let loIdx = pocIdx;
  let hiIdx = pocIdx;
  while (covered < total * VALUE_AREA && (loIdx > 0 || hiIdx < BIN_COUNT - 1)) {
    const below = loIdx > 0 ? volumes[loIdx - 1] : -1;
    const above = hiIdx < BIN_COUNT - 1 ? volumes[hiIdx + 1] : -1;
    if (above >= below) {
      hiIdx++;
      covered += volumes[hiIdx];
    } else {
      loIdx--;
      covered += volumes[loIdx];
    }
  }

  const binCenter = (i: number) => min + (i + 0.5) * binSize;
  return {
    poc: binCenter(pocIdx),
    vah: min + (hiIdx + 1) * binSize,
    val: min + loIdx * binSize,
    bins: volumes.map((v, i) => ({ price: binCenter(i), volume: v })),
  };
}
