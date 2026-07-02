# US Small-Cap SMC Scanner

เว็บสแกนหุ้นสหรัฐฯ ขนาดเล็ก (Small-Cap) แบบเรียลไทม์ สำหรับนักเทรดระยะสั้น
วิเคราะห์ด้วย **Smart Money Concept (SMC)** และ **Volume Profile**

## Pipeline: Browsing → Analyse → Conclude

1. **Browsing** — ดึงหุ้นจาก Yahoo Finance screeners (small-cap gainers, day gainers,
   aggressive small caps, most actives) แล้วคัดกรอง: มูลค่าตลาด $50M–$2B,
   ราคาบวก, วอลุ่มสูงกว่าค่าเฉลี่ย ≥ 1.5 เท่า
2. **Analyse** — วิเคราะห์กราฟรายวัน ~3 เดือนของแต่ละตัว:
   - **Volume Profile**: POC (Point of Control), Value Area High/Low (70%)
   - **SMC**: จุด swing high/low → Break of Structure (BOS) → Bullish Order Block
     (แท่งแดงสุดท้ายก่อน impulse ขาขึ้นที่วอลุ่มสูงและทะลุโครงสร้าง)
3. **Conclude** — จัดอันดับ 10 ตัว พร้อมระดับราคา:
   - **จุดเข้าซื้อ** = ขอบบน Order Block · **SL** = ใต้ฐาน Order Block
   - **High** = แนวต้านโครงสร้าง · **TP** = เป้าอนุรักษ์นิยม (คุมด้วย VAH)
   - **Mid** = ค่าเฉลี่ยกลางระหว่างจุดเข้ากับ High

## หน้าเว็บ

- **หน้าหลัก** (`/`) — Dashboard + ตารางหุ้นแนะนำ 10 อันดับ (ราคา pre-market,
  High, TP, Mid, จุดเข้าซื้อ, SL) อัปเดตราคาทุก 15 วินาที + ดาวน์โหลด CSV
- **กราฟและข่าว** (`/graph/[ticker]`) — กราฟเรียลไทม์จาก TradingView +
  กราฟแท่งเทียน (Lightweight Charts) พร้อมเส้นระดับราคา High/TP/Mid/Buy(OB)/SL
  + รายละเอียดการวิเคราะห์ + ข่าวล่าสุด
- **สรุปผล** (`/conclude`) — กำไรคาดหวัง / ความเสี่ยง / Risk:Reward ของแต่ละตัว
  พร้อมเหตุผลที่เลือก

## Stack

Next.js 14 (App Router, TypeScript) · Tailwind CSS · yahoo-finance2 (ไม่ต้องใช้ API key) ·
lightweight-charts · TradingView embed widget

## Run

```bash
npm install
npm run dev   # http://localhost:3000
```

> ⚠️ ข้อมูลเพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน
