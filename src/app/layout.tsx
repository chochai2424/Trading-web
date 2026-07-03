import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "US Stocks SMC Scanner",
  description:
    "สแกนหุ้นสหรัฐฯ ทุกขนาดแบบเรียลไทม์ ด้วย Smart Money Concept และ Volume Profile เน้นหุ้นเทคโนโลยีใกล้ถึงจุดทำกำไร",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-7xl border-t border-border px-4 py-6 text-xs text-muted">
          ข้อมูลจาก Yahoo Finance และ TradingView
          เพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน —
          การลงทุนมีความเสี่ยง ผู้ลงทุนควรศึกษาข้อมูลก่อนตัดสินใจลงทุน
        </footer>
      </body>
    </html>
  );
}
