"use client";

import { useEffect, useRef, useState } from "react";
import {
  ColorType,
  createChart,
  LineStyle,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle, Levels } from "@/lib/types";
import { fmtUsd, LEVEL_COLORS, LEVEL_LABELS_TH } from "@/lib/format";

const LINE_SPECS: {
  key: keyof Levels;
  title: string;
  style: LineStyle;
}[] = [
  { key: "high", title: "High", style: LineStyle.Solid },
  { key: "takeProfit", title: "TP", style: LineStyle.Dashed },
  { key: "mid", title: "Mid", style: LineStyle.Dotted },
  { key: "entry", title: "Buy (OB)", style: LineStyle.Dashed },
  { key: "stopLoss", title: "SL", style: LineStyle.Dashed },
];

// Candlestick chart (TradingView Lightweight Charts) with the five
// analysis levels drawn as labeled horizontal price lines.
export default function LevelChart({
  symbol,
  levels,
}: {
  symbol: string;
  levels: Levels;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [interval, setInterval] = useState<"1d" | "15m">("1d");

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    let chart: IChartApi | null = null;
    let disposed = false;
    setStatus("loading");

    (async () => {
      try {
        const res = await fetch(`/api/history/${symbol}?interval=${interval}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { candles } = (await res.json()) as { candles: Candle[] };
        if (disposed || !candles?.length) {
          if (!candles?.length) setStatus("error");
          return;
        }

        chart = createChart(el, {
          layout: {
            background: { type: ColorType.Solid, color: "#1a1a19" },
            textColor: "#898781",
          },
          grid: {
            vertLines: { color: "#2c2c2a" },
            horzLines: { color: "#2c2c2a" },
          },
          rightPriceScale: { borderColor: "#383835" },
          timeScale: {
            borderColor: "#383835",
            timeVisible: interval === "15m",
            secondsVisible: false,
          },
          crosshair: { horzLine: { labelBackgroundColor: "#383835" } },
          autoSize: true,
        });

        const series = chart.addCandlestickSeries({
          upColor: "#0ca30c",
          downColor: "#d03b3b",
          borderUpColor: "#0ca30c",
          borderDownColor: "#d03b3b",
          wickUpColor: "#0ca30c",
          wickDownColor: "#d03b3b",
        });
        series.setData(
          candles.map((c) => ({
            time: c.time as UTCTimestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        );

        const volume = chart.addHistogramSeries({
          priceFormat: { type: "volume" },
          priceScaleId: "vol",
          color: "#3987e5",
        });
        chart
          .priceScale("vol")
          .applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
        volume.setData(
          candles.map((c) => ({
            time: c.time as UTCTimestamp,
            value: c.volume,
            color: c.close >= c.open ? "#0ca30c66" : "#d03b3b66",
          }))
        );

        for (const spec of LINE_SPECS) {
          series.createPriceLine({
            price: levels[spec.key],
            color: LEVEL_COLORS[spec.key],
            lineWidth: 2,
            lineStyle: spec.style,
            axisLabelVisible: true,
            title: spec.title,
          });
        }

        chart.timeScale().fitContent();
        setStatus("ready");
      } catch (err) {
        console.error("level chart failed:", err);
        if (!disposed) setStatus("error");
      }
    })();

    return () => {
      disposed = true;
      chart?.remove();
    };
  }, [symbol, levels, interval]);

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-ink-2">
            กราฟพร้อมระดับราคา SMC · {symbol}
          </h3>
          <div className="flex gap-1" role="group" aria-label="เลือกช่วงเวลา">
            {(["1d", "15m"] as const).map((iv) => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                  interval === iv
                    ? "border-lv-entry bg-lv-entry/10 text-ink"
                    : "border-border text-muted hover:text-ink-2"
                }`}
              >
                {iv === "1d" ? "รายวัน" : "15 นาที"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {LINE_SPECS.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-0.5 w-4"
                style={{ backgroundColor: LEVEL_COLORS[s.key] }}
              />
              <span className="text-ink-2">
                {LEVEL_LABELS_TH[s.key]}{" "}
                <span className="tabular text-muted">
                  {fmtUsd(levels[s.key])}
                </span>
              </span>
            </span>
          ))}
        </div>
      </div>
      <div className="relative h-[420px]">
        <div ref={container} className="absolute inset-0" />
        {status !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
            {status === "loading" ? "กำลังโหลดกราฟ..." : "โหลดกราฟไม่สำเร็จ"}
          </div>
        )}
      </div>
    </div>
  );
}
