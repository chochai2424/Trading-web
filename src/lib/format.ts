// Shared display constants and formatters (client-safe, no server deps)

export const LEVEL_COLORS = {
  high: "#9085e9",
  takeProfit: "#0ca30c",
  mid: "#d55181",
  entry: "#3987e5",
  stopLoss: "#d03b3b",
} as const;

export const LEVEL_LABELS_TH = {
  high: "High (แนวต้านสูงสุด)",
  takeProfit: "Take Profit (จุดขายทำกำไร)",
  mid: "Mid (ค่าเฉลี่ยกลาง)",
  entry: "จุดเข้าซื้อ (Order Block)",
  stopLoss: "Stop Loss (จุดตัดขาดทุน)",
} as const;

export const CAP_TIER_LABELS: Record<string, string> = {
  mega: "Mega Cap",
  large: "Large Cap",
  mid: "Mid Cap",
  small: "Small Cap",
};

// Market-state-aware price display:
//   PRE  -> pre-market price is the headline, regular close beneath
//   REGULAR -> live price (updates every poll)
//   POST/CLOSED -> close is the headline, after-market price beneath
export function priceDisplay(
  marketState: string,
  price: number,
  pre: number | null,
  post: number | null
): { main: number; subLabel: string | null; sub: number | null } {
  if (marketState.startsWith("PRE") && pre != null) {
    return { main: pre, subLabel: "ปิดล่าสุด", sub: price };
  }
  if (marketState === "REGULAR") {
    return { main: price, subLabel: null, sub: null };
  }
  if (post != null) {
    return { main: price, subLabel: "after", sub: post };
  }
  if (pre != null) {
    return { main: price, subLabel: "pre", sub: pre };
  }
  return { main: price, subLabel: null, sub: null };
}

export function fmtUsd(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "-";
  return `$${v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: v < 1 ? 4 : 2,
  })}`;
}

export function fmtPct(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "-";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export function fmtCap(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString("en-US")}`;
}

export function fmtVolume(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return `${v}`;
}

export function fmtTimeTh(ms: number): string {
  return new Date(ms).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
