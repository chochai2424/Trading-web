"use client";

import Link from "next/link";
import { useScreen } from "@/components/useScreen";
import { fmtPct, fmtTimeTh, fmtUsd } from "@/lib/format";

export default function ConcludePage() {
  const { data, error } = useScreen();

  if (error && !data) {
    return (
      <div className="rounded-lg border border-down/40 bg-surface p-6 text-sm text-ink-2">
        ไม่สามารถโหลดข้อมูลได้ ({error})
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-ink-2">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-grid border-t-lv-entry" />
        <p className="text-sm">กำลังสรุปผลการวิเคราะห์...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold">สรุปผลที่คาดหวัง (Expected Result)</h1>
        <p className="mt-1 text-sm text-ink-2">
          กำไรที่คาดหวังจากจุดเข้าซื้อ (Order Block) ไปยัง Take Profit
          เทียบกับความเสี่ยงหากราคาหลุด Stop Loss
        </p>
        <p className="mt-1 text-xs text-muted">
          ข้อมูล ณ {fmtTimeTh(data.generatedAt)}
        </p>
      </section>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-2 font-medium">ชื่อหุ้น</th>
              <th className="px-4 py-2 font-medium">จุดเข้าซื้อ (OB)</th>
              <th className="px-4 py-2 font-medium">Take Profit</th>
              <th className="px-4 py-2 font-medium">Stop Loss</th>
              <th className="px-4 py-2 font-medium">กำไรคาดหวัง</th>
              <th className="px-4 py-2 font-medium">ความเสี่ยง</th>
              <th className="px-4 py-2 font-medium">Risk : Reward</th>
            </tr>
          </thead>
          <tbody>
            {data.picks.map((p) => {
              const gain =
                ((p.levels.takeProfit - p.levels.entry) / p.levels.entry) * 100;
              const risk =
                ((p.levels.entry - p.levels.stopLoss) / p.levels.entry) * 100;
              const rr = risk > 0 ? gain / risk : 0;
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
                  </td>
                  <td className="tabular px-4 py-2.5">{fmtUsd(p.levels.entry)}</td>
                  <td className="tabular px-4 py-2.5">
                    {fmtUsd(p.levels.takeProfit)}
                  </td>
                  <td className="tabular px-4 py-2.5">
                    {fmtUsd(p.levels.stopLoss)}
                  </td>
                  <td className="tabular px-4 py-2.5 font-medium text-up">
                    {fmtPct(gain)}
                  </td>
                  <td className="tabular px-4 py-2.5 font-medium text-down">
                    {fmtPct(-risk)}
                  </td>
                  <td className="tabular px-4 py-2.5">
                    1 : {rr.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-2">
          เหตุผลที่เลือกแต่ละตัว
        </h2>
        {data.picks.map((p, i) => (
          <div
            key={p.symbol}
            className="rounded-lg border border-border bg-surface px-4 py-3"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-muted">#{i + 1}</span>
              <Link
                href={`/graph/${p.symbol}`}
                className="font-semibold text-lv-entry hover:underline"
              >
                {p.symbol}
              </Link>
              <span className="text-xs text-ink-2">{p.name}</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-ink-2">{p.rationaleTh}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
