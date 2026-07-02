"use client";

import { useEffect, useRef } from "react";

// Official TradingView Advanced Chart embed (free widget).
// Custom drawings can't be injected into this widget — the LevelChart
// below it carries the High/Mid/TP/SL/OB lines.
export default function TradingViewWidget({ symbol }: { symbol: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    el.innerHTML = "";
    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: "15",
      timezone: "Asia/Bangkok",
      theme: "dark",
      style: "1",
      locale: "th_TH",
      backgroundColor: "#1a1a19",
      hide_side_toolbar: false,
      allow_symbol_change: false,
      support_host: "https://www.tradingview.com",
    });
    el.appendChild(script);
    return () => {
      el.innerHTML = "";
    };
  }, [symbol]);

  return (
    <div className="h-[480px] overflow-hidden rounded-lg border border-border bg-surface">
      <div ref={container} className="tradingview-widget-container h-full" />
    </div>
  );
}
