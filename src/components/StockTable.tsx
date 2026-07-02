"use client";

import Link from "next/link";
import type { Quote, StockPick } from "@/lib/types";
import { fmtPct, fmtUsd, LEVEL_COLORS } from "@/lib/format";

function LevelCell({ value, color }: { value: number; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="tabular">{fmtUsd(value)}</span>
    </span>
  );
}

export default function StockTable({
  picks,
  quotes,
  title,
  onRemove,
}: {
  picks: StockPick[];
  quotes: Record<string, Quote>;
  title?: string;
  onRemove?: (symbol: string) => void;
}) {
  const exportCsv = () => {
    const header = [
      "ชื่อหุ้น",
      "ราคาปัจจุบัน (pre market)",
      "High",
      "Take Profit",
      "Mid",
      "จุดเข้าซื้อ (Order Block)",
      "Stop Loss",
      "เปลี่ยนแปลง %",
    ];
    const rows = picks.map((p) => {
      const q = quotes[p.symbol];
      const price = q?.preMarketPrice ?? q?.price ?? p.preMarketPrice ?? p.price;
      return [
        p.symbol,
        price,
        p.levels.high,
        p.levels.takeProfit,
        p.levels.mid,
        p.levels.entry,
        p.levels.stopLoss,
        (q?.changePercent ?? p.changePercent).toFixed(2),
      ].join(",");
    });
    const blob = new Blob(["﻿" + [header.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `smc-scan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-ink-2">
          {title ?? "ตารางหุ้นแนะนำ 10 อันดับ (Small-Cap · SMC + Volume Profile)"}
        </h2>
        <button
          onClick={exportCsv}
          className="rounded-md border border-border px-3 py-1 text-xs text-ink-2 hover:bg-grid hover:text-ink"
        >
          ดาวน์โหลด CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-2 font-medium">ชื่อหุ้น</th>
              <th className="px-4 py-2 font-medium">
                ราคาปัจจุบัน{" "}
                <span className="font-normal">(pre market)</span>
              </th>
              <th className="px-4 py-2 font-medium">เปลี่ยนแปลง</th>
              <th className="px-4 py-2 font-medium">High</th>
              <th className="px-4 py-2 font-medium">Take Profit</th>
              <th className="px-4 py-2 font-medium">
                Mid <span className="font-normal">(ค่าเฉลี่ยกลาง)</span>
              </th>
              <th className="px-4 py-2 font-medium">
                จุดเข้าซื้อ <span className="font-normal">(OB)</span>
              </th>
              <th className="px-4 py-2 font-medium">Stop Loss</th>
              {onRemove && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody>
            {picks.map((p) => {
              const q = quotes[p.symbol];
              const pre = q?.preMarketPrice ?? p.preMarketPrice;
              const price = q?.price ?? p.price;
              const change = q?.changePercent ?? p.changePercent;
              return (
                <tr
                  key={p.symbol}
                  className="border-b border-grid last:border-0 hover:bg-grid/40"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/graph/${p.symbol}`}
                      className="font-semibold text-lv-entry hover:underline"
                    >
                      {p.symbol}
                    </Link>
                    <div className="max-w-[180px] truncate text-xs text-muted">
                      {p.name}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="tabular font-medium">{fmtUsd(price)}</div>
                    <div className="tabular text-xs text-muted">
                      pre: {pre != null ? fmtUsd(pre) : "-"}
                    </div>
                  </td>
                  <td
                    className={`tabular px-4 py-2.5 font-medium ${
                      change >= 0 ? "text-up" : "text-down"
                    }`}
                  >
                    {fmtPct(change)}
                  </td>
                  <td className="px-4 py-2.5">
                    <LevelCell value={p.levels.high} color={LEVEL_COLORS.high} />
                  </td>
                  <td className="px-4 py-2.5">
                    <LevelCell
                      value={p.levels.takeProfit}
                      color={LEVEL_COLORS.takeProfit}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <LevelCell value={p.levels.mid} color={LEVEL_COLORS.mid} />
                  </td>
                  <td className="px-4 py-2.5">
                    <LevelCell
                      value={p.levels.entry}
                      color={LEVEL_COLORS.entry}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <LevelCell
                      value={p.levels.stopLoss}
                      color={LEVEL_COLORS.stopLoss}
                    />
                  </td>
                  {onRemove && (
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => onRemove(p.symbol)}
                        aria-label={`ลบ ${p.symbol} ออกจากรายการโปรด`}
                        className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:border-down hover:text-down"
                      >
                        ลบ
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
