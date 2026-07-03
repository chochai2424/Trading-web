"use client";

import { useMemo, useState } from "react";
import StockTable from "@/components/StockTable";
import { useQuotes, useScreen } from "@/components/useScreen";
import { fmtPct, fmtTimeTh, fmtVolume } from "@/lib/format";
import type { CapTier } from "@/lib/types";

const TIER_CHIPS: { key: CapTier | "all"; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "mega", label: "Mega" },
  { key: "large", label: "Large" },
  { key: "mid", label: "Mid" },
  { key: "small", label: "Small" },
];

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-2">{sub}</div>}
    </div>
  );
}

export default function MainPage() {
  const { data, error } = useScreen();
  const [tier, setTier] = useState<CapTier | "all">("all");
  const [techOnly, setTechOnly] = useState(false);
  const symbols = useMemo(
    () => (data ? data.picks.map((p) => p.symbol) : []),
    [data]
  );
  const quotes = useQuotes(symbols);
  const visiblePicks = useMemo(() => {
    if (!data) return [];
    return data.picks.filter(
      (p) =>
        (tier === "all" || p.capTier === tier) &&
        (!techOnly || p.sector === "Technology")
    );
  }, [data, tier, techOnly]);

  if (error && !data) {
    return (
      <div className="rounded-lg border border-down/40 bg-surface p-6 text-sm text-ink-2">
        ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง ({error})
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-ink-2">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-grid border-t-lv-entry" />
        <p className="text-sm">
          กำลังสแกนหุ้น... (Browsing → Analyse → Conclude)
        </p>
        <p className="text-xs text-muted">
          คัดกรองหุ้น Small-Cap ที่มีวอลุ่มซื้อสูง แล้ววิเคราะห์ด้วย SMC และ
          Volume Profile
        </p>
      </div>
    );
  }

  const avgChange =
    data.picks.reduce((a, p) => a + (quotes[p.symbol]?.changePercent ?? p.changePercent), 0) /
    Math.max(data.picks.length, 1);
  const bosCount = data.picks.filter((p) => p.smc.bullishBos).length;
  const totalVolume = data.picks.reduce((a, p) => a + p.volume, 0);

  return (
    <div className="space-y-6">
      {data.dataSource === "sample" && (
        <div className="rounded-lg border border-lv-mid/50 bg-surface px-4 py-3 text-sm text-ink-2">
          ⚠️ <span className="font-semibold text-ink">โหมดข้อมูลตัวอย่าง</span>{" "}
          — ขณะนี้เชื่อมต่อ Yahoo Finance ไม่ได้
          ระบบกำลังแสดงข้อมูลจำลองเพื่อสาธิตการทำงานของตัววิเคราะห์
          ราคาและระดับต่าง ๆ ไม่ใช่ข้อมูลตลาดจริง
        </div>
      )}
      <section>
        <h1 className="text-xl font-bold">
          หุ้นแนะนำวันนี้ · US Stocks Momentum (ทุกขนาด)
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          สแกนหุ้นสหรัฐฯ ทุกขนาด Mega/Large/Mid/Small ทุกกลุ่มอุตสาหกรรม
          (NYSE / NASDAQ / S&P 500) ที่มีแรงซื้อผิดปกติดันราคาเป็นขาขึ้น
          เน้นหุ้นเทคโนโลยีที่ใกล้ถึงจุดทำกำไร (ตลาดคาดหวังต่ำ ศักยภาพโตสูง)
          วิเคราะห์ด้วย Smart Money Concept (Order Block / BOS) และ Volume
          Profile (POC / Value Area)
        </p>
        <p className="mt-1 text-xs text-muted">
          รายชื่อรอบวันที่ {data.tradingDay} (อัปเดตรอบใหม่ทุกวันช่วงเริ่ม
          pre-market 04:00 ET) · สแกนเมื่อ {fmtTimeTh(data.generatedAt)} ·
          สถานะตลาด: {data.marketState} · ราคาอัปเดตทุก 10 วินาทีช่วงตลาดเปิด
          / 15 วินาทีนอกเวลา
        </p>
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1" role="group" aria-label="กรองตามขนาดหุ้น">
          {TIER_CHIPS.map((c) => (
            <button
              key={c.key}
              onClick={() => setTier(c.key)}
              className={`rounded-md border px-3 py-1 text-xs font-medium ${
                tier === c.key
                  ? "border-lv-entry bg-lv-entry/10 text-ink"
                  : "border-border text-ink-2 hover:bg-grid/60"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setTechOnly((v) => !v)}
          className={`rounded-md border px-3 py-1 text-xs font-medium ${
            techOnly
              ? "border-lv-tp bg-lv-tp/10 text-ink"
              : "border-border text-ink-2 hover:bg-grid/60"
          }`}
        >
          เฉพาะ Technology
        </button>
        {visiblePicks.length < data.picks.length && (
          <span className="text-xs text-muted">
            แสดง {visiblePicks.length} จาก {data.picks.length} ตัว
          </span>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="หุ้นที่ผ่านเกณฑ์" value={`${data.picks.length}`} sub="จากการสแกนตลาด" />
        <StatTile
          label="การเปลี่ยนแปลงเฉลี่ย"
          value={fmtPct(avgChange)}
          sub="ของหุ้นที่แนะนำ"
        />
        <StatTile
          label="ยืนยัน BOS ขาขึ้น"
          value={`${bosCount}/${data.picks.length}`}
          sub="Break of Structure"
        />
        <StatTile
          label="วอลุ่มรวมวันนี้"
          value={fmtVolume(totalVolume)}
          sub="หุ้นที่แนะนำทั้งหมด"
        />
      </section>

      <StockTable picks={visiblePicks} quotes={quotes} />

      <section className="rounded-lg border border-border bg-surface p-4 text-xs leading-5 text-ink-2">
        <h3 className="mb-1 font-semibold text-ink">วิธีอ่านตาราง</h3>
        <ul className="list-inside list-disc space-y-1">
          <li>
            <span className="text-lv-entry">จุดเข้าซื้อ (OB)</span> —
            ขอบบนของ Order Block ฝั่งซื้อ รอราคาย่อตัวลงมาทดสอบโซนนี้ก่อนเข้าซื้อ
          </li>
          <li>
            <span className="text-lv-tp">Take Profit</span> —
            เป้าขายทำกำไรแบบอนุรักษ์นิยม (ต่ำกว่าแนวต้าน และไม่เกิน Value Area High)
          </li>
          <li>
            <span className="text-lv-mid">Mid</span> — ค่าเฉลี่ยกลางระหว่างจุดเข้าซื้อกับ High
          </li>
          <li>
            <span className="text-lv-sl">Stop Loss</span> — ใต้ฐาน Order Block
            หากหลุดแสดงว่าโครงสร้างขาขึ้นเสีย
          </li>
        </ul>
      </section>
    </div>
  );
}
