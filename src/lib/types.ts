export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface VolumeProfile {
  poc: number; // point of control (price with highest traded volume)
  vah: number; // value area high (70% volume)
  val: number; // value area low
  bins: { price: number; volume: number }[];
}

export interface OrderBlock {
  high: number;
  low: number;
  time: number;
  confirmed: boolean; // impulse from this block broke structure with high volume
}

export interface SmcAnalysis {
  swingHigh: number;
  swingLow: number;
  bullishBos: boolean; // break of structure to the upside
  orderBlock: OrderBlock | null;
  impulseRelVolume: number; // impulse leg volume vs 20-bar average
}

export interface Levels {
  high: number; // recent structural high / resistance
  takeProfit: number; // conservative target below high
  mid: number; // midpoint between entry and high
  entry: number; // buy-in zone from the order block
  stopLoss: number; // below the order block low
}

export interface IntradayInfo {
  bullishBos: boolean;
  orderBlockHigh: number | null;
  orderBlockLow: number | null;
  refined: boolean; // entry/SL tightened using the 15m order block
}

export interface StockPick {
  symbol: string;
  name: string;
  price: number; // regular market price
  preMarketPrice: number | null;
  changePercent: number;
  marketCap: number;
  volume: number;
  avgVolume: number;
  relVolume: number;
  levels: Levels;
  volumeProfile: { poc: number; vah: number; val: number };
  smc: {
    bullishBos: boolean;
    orderBlockHigh: number | null;
    orderBlockLow: number | null;
    impulseRelVolume: number;
  };
  intraday: IntradayInfo | null; // 15m refinement (null = not analyzed)
  score: number;
  rationaleTh: string; // analysis summary in Thai
}

export interface ScreenResult {
  generatedAt: number; // unix ms
  marketState: string;
  dataSource: "live" | "sample"; // sample = Yahoo unreachable, demo data
  picks: StockPick[];
}

export interface Quote {
  symbol: string;
  price: number;
  preMarketPrice: number | null;
  postMarketPrice: number | null;
  changePercent: number;
  marketState: string;
  updatedAt: number;
}

export interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  publishedAt: number; // unix ms
  thumbnail: string | null;
}
