"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import LevelChart from "@/components/LevelChart";
import NewsList from "@/components/NewsList";
import TradingViewWidget from "@/components/TradingViewWidget";
import { useQuotes, useScreen } from "@/components/useScreen";
import { useWatchlist } from "@/components/useWatchlist";
import { fmtCap, fmtPct, fmtUsd, fmtVolume } from "@/lib/format";
import type { StockPick } from "@/lib/types";

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
  const { add, remove, has } = useWatchlist();

  const screenPick = data?.picks.find((p) => p.symbol === symbol) ?? null;

  // Tickers outside the top-10 (e.g. from the watchlist) get analyzed
  // on demand so the level chart and detail panel still work
  const [analyzed, setAnalyzed] = useState<StockPick | null>(null);
  const [analyzeFailed, setAnalyzeFailed] = useState(false);
  useEffect(() => {
    setAnalyzed(null);
    setAnalyzeFailed(false);
    if (!data || screenPick) return;
    let alive = true;
    fetch(`/api/analyze/${symbol}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((json) => alive && setAnalyzed(json as StockPick))
      .catch(() => alive && setAnalyzeFailed(true));
    return () => {
      alive = false;
    };
  }, [symbol, data, screenPick]);

  const pick = screenPick ?? analyzed;
  const inWatchlist = has(symbol);
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
        <h1 className="flex items-center gap-2 text-xl font-bold">
          {symbol}
          <button
            onClick={() => (inWatchlist ? remove(symbol) : add(symbol))}
            aria-label={
              inWatchlist ? "ลบออกจากรายการโปรด" : "เพิ่มเข้ารายการโปรด"
            }
            title={inWatchlist ? "ลบออกจากรายการโปรด" : "เพิ่มเข้ารายการโปรด"}
            className={`text-lg leading-none ${
              inWatchlist ? "text-lv-mid" : "text-muted hover:text-ink-2"
            }`}
          >
            {inWatchlist ? "★" : "☆"}
          </button>
        </h1>
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
      ) : analyzeFailed ? (
        <div className="rounded-lg border border-border bg-surface p-4 text-sm text-ink-2">
          วิเคราะห์หุ้นตัวนี้ไม่สำเร็จ (ไม่พบข้อมูลหรือข้อมูลไม่พอ) —
          ดูหุ้นแนะนำได้ที่{" "}
          <Link href="/" className="text-lv-entry hover:underline">
            หน้าหลัก
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
          กำลังวิเคราะห์ระดับราคา SMC ของ {symbol}...
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
              {pick.intraday && (
                <>
                  <DetailRow
                    label="BOS กราฟ 15 นาที"
                    value={
                      pick.intraday.bullishBos ? "ยืนยันขาขึ้น ✓" : "ยังไม่ยืนยัน"
                    }
                  />
                  <DetailRow
                    label="Order Block 15 นาที"
                    value={
                      pick.intraday.orderBlockLow != null
                        ? `${fmtUsd(pick.intraday.orderBlockLow)} – ${fmtUsd(pick.intraday.orderBlockHigh)}${pick.intraday.refined ? " (ใช้ปรับจุดเข้า)" : ""}`
                        : "-"
                    }
                  />
                </>
              )}
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
