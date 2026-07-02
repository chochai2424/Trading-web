import type { Candle, OrderBlock, SmcAnalysis } from "./types";

const SWING_LOOKBACK = 2; // fractal width: bar must exceed 2 bars on each side
const VOLUME_WINDOW = 20;
const IMPULSE_VOL_FACTOR = 1.3; // impulse leg must trade above avg volume

interface SwingPoint {
  index: number;
  price: number;
}

function findSwingHighs(candles: Candle[]): SwingPoint[] {
  const swings: SwingPoint[] = [];
  for (let i = SWING_LOOKBACK; i < candles.length - SWING_LOOKBACK; i++) {
    let isSwing = true;
    for (let j = 1; j <= SWING_LOOKBACK; j++) {
      if (
        candles[i].high <= candles[i - j].high ||
        candles[i].high <= candles[i + j].high
      ) {
        isSwing = false;
        break;
      }
    }
    if (isSwing) swings.push({ index: i, price: candles[i].high });
  }
  return swings;
}

function findSwingLows(candles: Candle[]): SwingPoint[] {
  const swings: SwingPoint[] = [];
  for (let i = SWING_LOOKBACK; i < candles.length - SWING_LOOKBACK; i++) {
    let isSwing = true;
    for (let j = 1; j <= SWING_LOOKBACK; j++) {
      if (
        candles[i].low >= candles[i - j].low ||
        candles[i].low >= candles[i + j].low
      ) {
        isSwing = false;
        break;
      }
    }
    if (isSwing) swings.push({ index: i, price: candles[i].low });
  }
  return swings;
}

function avgVolume(candles: Candle[], endIdx: number): number {
  const start = Math.max(0, endIdx - VOLUME_WINDOW);
  const slice = candles.slice(start, endIdx);
  if (slice.length === 0) return 0;
  return slice.reduce((a, c) => a + c.volume, 0) / slice.length;
}

// Find the bullish order block behind the most recent break of structure:
// the last bearish (down-close) candle before the high-volume impulse leg
// that pushed price above the prior swing high.
function findBullishOrderBlock(
  candles: Candle[],
  bosIndex: number
): { block: OrderBlock | null; impulseRelVolume: number } {
  // Walk back from the BOS bar over the bullish impulse leg
  let i = bosIndex;
  let impulseVolume = 0;
  let impulseBars = 0;
  while (i > 0 && candles[i].close >= candles[i].open) {
    impulseVolume += candles[i].volume;
    impulseBars++;
    i--;
  }
  const baseVolume = avgVolume(candles, Math.max(i, 1));
  const impulseRelVolume =
    baseVolume > 0 && impulseBars > 0
      ? impulseVolume / impulseBars / baseVolume
      : 0;

  // candles[i] is now the last down-close candle before the impulse
  if (i <= 0 || candles[i].close >= candles[i].open) {
    return { block: null, impulseRelVolume };
  }
  const ob = candles[i];
  return {
    block: {
      high: ob.high,
      low: ob.low,
      time: ob.time,
      confirmed: impulseRelVolume >= IMPULSE_VOL_FACTOR,
    },
    impulseRelVolume,
  };
}

export function analyzeSmc(candles: Candle[]): SmcAnalysis | null {
  if (candles.length < 20) return null;

  const swingHighs = findSwingHighs(candles);
  const swingLows = findSwingLows(candles);
  if (swingHighs.length === 0 || swingLows.length === 0) return null;

  const lastClose = candles[candles.length - 1].close;

  // Bullish BOS: the latest close has taken out the most recent confirmed
  // swing high that formed before the current up-leg.
  let bosIndex = -1;
  let brokenSwing: SwingPoint | null = null;
  for (let s = swingHighs.length - 1; s >= 0; s--) {
    const swing = swingHighs[s];
    for (let i = swing.index + SWING_LOOKBACK; i < candles.length; i++) {
      if (candles[i].close > swing.price) {
        if (i > bosIndex) {
          bosIndex = i;
          brokenSwing = swing;
        }
        break;
      }
    }
    if (bosIndex >= 0) break;
  }

  const bullishBos = bosIndex >= 0 && lastClose > (brokenSwing?.price ?? Infinity) * 0.97;

  let orderBlock: OrderBlock | null = null;
  let impulseRelVolume = 0;
  if (bosIndex >= 0) {
    const res = findBullishOrderBlock(candles, bosIndex);
    orderBlock = res.block;
    impulseRelVolume = res.impulseRelVolume;
  }

  return {
    swingHigh: Math.max(...swingHighs.slice(-3).map((s) => s.price)),
    swingLow: Math.min(...swingLows.slice(-3).map((s) => s.price)),
    bullishBos,
    orderBlock,
    impulseRelVolume,
  };
}
