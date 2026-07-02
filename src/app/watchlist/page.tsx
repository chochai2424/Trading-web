"use client";

import { useMemo, useState } from "react";
import StockTable from "@/components/StockTable";
import { useQuotes } from "@/components/useScreen";
import { useAnalyzedPicks, useWatchlist } from "@/components/useWatchlist";

export default function WatchlistPage() {
  const { symbols, add, remove } = useWatchlist();
  const { picks, failed } = useAnalyzedPicks(symbols);
  const quotes = useQuotes(symbols);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const orderedPicks = useMemo(
    () => symbols.map((s) => picks[s]).filter(Boolean),
    [symbols, picks]
  );
  const loading = symbols.filter(
    (s) => !picks[s] && !failed.includes(s)
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = input.trim().toUpperCase();
    if (!s) return;
    if (add(s)) {
      setInput("");
      setMessage(null);
    } else {
      setMessage(
        symbols.includes(s)
          ? `${s} อยู่ในรายการโปรดแล้ว`
          : "รูปแบบชื่อหุ้นไม่ถูกต้อง (เช่น SOUN, BBAI)"
      );
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold">รายการโปรด (Watchlist)</h1>
        <p className="mt-1 text-sm text-ink-2">
          เพิ่มหุ้นที่สนใจ ระบบจะวิเคราะห์ด้วย SMC + Volume Profile
          (รวมการปรับจุดเข้าซื้อจากกราฟ 15 นาที)
          และแจ้งเตือนเมื่อราคาแตะระดับสำคัญเช่นเดียวกับหุ้นแนะนำ
        </p>
      </section>

      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="พิมพ์ชื่อหุ้น เช่น SOUN"
          aria-label="เพิ่มหุ้นเข้ารายการโปรด"
          className="w-56 rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-lv-entry focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md border border-lv-entry bg-lv-entry/10 px-4 py-2 text-sm font-medium text-ink hover:bg-lv-entry/20"
        >
          + เพิ่มหุ้น
        </button>
        {message && <span className="text-xs text-lv-mid">{message}</span>}
      </form>

      {symbols.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted">
          ยังไม่มีหุ้นในรายการโปรด — เพิ่มหุ้นด้านบน
          หรือกดปุ่มดาว ★ ในหน้ากราฟของหุ้นที่สนใจ
        </div>
      ) : (
        <>
          {loading.length > 0 && (
            <p className="text-xs text-muted">
              กำลังวิเคราะห์: {loading.join(", ")}...
            </p>
          )}
          {failed.length > 0 && (
            <p className="text-xs text-down">
              วิเคราะห์ไม่สำเร็จ (ข้อมูลไม่พอหรือไม่พบหุ้น): {failed.join(", ")}
            </p>
          )}
          {orderedPicks.length > 0 && (
            <StockTable
              picks={orderedPicks}
              quotes={quotes}
              title={`หุ้นในรายการโปรด (${orderedPicks.length} ตัว)`}
              onRemove={remove}
            />
          )}
        </>
      )}
    </div>
  );
}
