import type { Quote, StockPick } from "./types";

export type AlertLevel = "entry" | "takeProfit" | "stopLoss";

export interface LevelAlert {
  key: string; // de-dupe key: symbol:level:YYYY-MM-DD
  symbol: string;
  level: AlertLevel;
  price: number; // price that triggered the alert
  levelPrice: number; // the level that was hit
  time: number; // unix ms
  messageTh: string;
}

function dayStamp(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

// Pure alert evaluation: compares a live quote against a pick's levels.
// Each level fires at most once per symbol per day (firedKeys).
export function evaluateAlerts(
  pick: StockPick,
  quote: Quote,
  firedKeys: ReadonlySet<string>,
  now: number = Date.now()
): LevelAlert[] {
  const price = quote.price;
  if (!price || !isFinite(price)) return [];
  const { entry, takeProfit, stopLoss } = pick.levels;
  const alerts: LevelAlert[] = [];
  const stamp = dayStamp(now);

  const push = (
    level: AlertLevel,
    levelPrice: number,
    messageTh: string
  ) => {
    const key = `${pick.symbol}:${level}:${stamp}`;
    if (firedKeys.has(key)) return;
    alerts.push({
      key,
      symbol: pick.symbol,
      level,
      price,
      levelPrice,
      time: now,
      messageTh,
    });
  };

  if (price <= stopLoss) {
    push(
      "stopLoss",
      stopLoss,
      `${pick.symbol} หลุด Stop Loss $${stopLoss} — โครงสร้างขาขึ้นเสีย ควรตัดขาดทุน`
    );
  } else if (price <= entry) {
    push(
      "entry",
      entry,
      `${pick.symbol} ราคาย่อเข้าโซนซื้อ (Order Block) $${entry} — จับตาจุดเข้าซื้อ`
    );
  }
  if (price >= takeProfit) {
    push(
      "takeProfit",
      takeProfit,
      `${pick.symbol} ถึงเป้าขายทำกำไร $${takeProfit} — พิจารณาทยอยขาย`
    );
  }
  return alerts;
}
