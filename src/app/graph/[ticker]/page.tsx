"use client";

import Link from "next/link";
import { useMemo } from "react";
import LevelChart from "@/components/LevelChart";
import NewsList from "@/components/NewsList";
import TradingViewWidget from "@/components/TradingViewWidget";
import { useQuotes, useScreen } from "@/components/useScreen";
import { fmtCap, fmtPct, fmtUsd, fmtVolume } from "@/lib/format";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="tabular text-sm text-ink">{value}</span>
    </div>
  );
}

export default function GraphPage({
  params,
}: {
  params: { ticker: string };
}) {
  const symbol = params.ticker.toUpperCase();
  const { data } = useScreen();
  const symbols = useMemo(() => [symbol], [symbol]);
  const quotes = useQuotes(symbols);

  const pick = data?.picks.find((p) => p.symbol === symbol) ?? null;
  const quote = quotes[symbol];
  const price = quote?.price ?? pick?.price;
  const change = quote?.changePercent ?? pick?.changePercent;

  return (
    <div className="space-y-4">
      {/* Ticker tabs across the top-10 picks */}
      {data && (
        <nav className="flex flex-wrap gap-1.5">
          {data.picks.map((p) => (
            <Link
              key={p.symbol}
              href={`/graph/${p.symbol}`}
              className={`rounded-md border px-3 py-1 text-xs font-medium ${
                p.symbol === symbol
                  ? "border-lv-entry bg-lv-entry/10 text-ink"
                  : "border-border text-ink-2 hover:bg-grid/60"
              }`}
            >
              {p.symbol}
            </Link>
          ))}
        </nav>
      )}

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-xl font-bold">{symbol}</h1>
        {pick && <span className="text-sm text-ink-2">{pick.name}</span>}
        {price != null && (
          <span className="tabular text-lg font-semibold">{fmtUsd(price)}</span>
        )}
        {change != null && (
          <span
            className={`tabular text-sm font-medium ${
              change >= 0 ? "text-up" : "text-down"
            }`}
          >
            {fmtPct(change)}
          </span>
        )}
        {quote?.preMarketPrice != null && (
          <span className="tabular text-sm text-muted">
            pre-market: {fmtUsd(quote.preMarketPrice)}
          </span>
        )}
      </div>

      {/* Real-time chart from TradingView */}
      <TradingViewWidget symbol={symbol} />

      {/* Our chart with the SMC levels drawn as horizontal lines */}
      {pick ? (
        <LevelChart symbol={symbol} levels={pick.levels} />
      ) : (
        <div className="rounded-lg border border-border bg-surface p-4 text-sm text-ink-2">
          หุ้นตัวนี้ไม่อยู่ในผลสแกนรอบปัจจุบัน
          จึงไม่มีระดับราคา SMC ให้แสดง — ดูหุ้นแนะนำได้ที่{" "}
          <Link href="/" className="text-lv-entry hover:underline">
            หน้าหลัก
          </Link>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Analysis detail */}
        {pick && (
          <div className="rounded-lg border border-border bg-surface">
            <h3 className="border-b border-border px-4 py-3 text-sm font-semibold text-ink-2">
              รายละเอียดการวิเคราะห์
            </h3>
            <div className="divide-y divide-grid px-4 py-2">
              <DetailRow label="มูลค่าตลาด" value={fmtCap(pick.marketCap)} />
              <DetailRow
                label="วอลุ่มวันนี้ / เฉลี่ย 3 เดือน"
                value={`${fmtVolume(pick.volume)} / ${fmtVolume(pick.avgVolume)} (${pick.relVolume.toFixed(1)}x)`}
              />
              <DetailRow
                label="Break of Structure (BOS)"
                value={pick.smc.bullishBos ? "ยืนยันขาขึ้น ✓" : "ยังไม่ยืนยัน"}
              />
              <DetailRow
                label="Order Block ฝั่งซื้อ"
                value={
                  pick.smc.orderBlockLow != null
                    ? `${fmtUsd(pick.smc.orderBlockLow)} – ${fmtUsd(pick.smc.orderBlockHigh)}`
                    : "-"
                }
              />
              <DetailRow
                label="วอลุ่มช่วง Impulse เทียบค่าเฉลี่ย"
                value={`${pick.smc.impulseRelVolume.toFixed(1)}x`}
              />
              <DetailRow
                label="POC (Point of Control)"
                value={fmtUsd(pick.volumeProfile.poc)}
              />
              <DetailRow
                label="Value Area (VAL – VAH)"
                value={`${fmtUsd(pick.volumeProfile.val)} – ${fmtUsd(pick.volumeProfile.vah)}`}
              />
            </div>
            <p className="border-t border-border px-4 py-3 text-xs leading-5 text-ink-2">
              {pick.rationaleTh}
            </p>
          </div>
        )}

        <NewsList symbol={symbol} />
      </div>
    </div>
  );
}
