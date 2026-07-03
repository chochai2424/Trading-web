"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AlertCenter from "./AlertCenter";

const LINKS = [
  { href: "/", label: "หน้าหลัก", match: (p: string) => p === "/" },
  {
    href: "/graph",
    label: "กราฟและข่าว",
    match: (p: string) => p.startsWith("/graph"),
  },
  {
    href: "/conclude",
    label: "สรุปผล",
    match: (p: string) => p.startsWith("/conclude"),
  },
  {
    href: "/watchlist",
    label: "รายการโปรด",
    match: (p: string) => p.startsWith("/watchlist"),
  },
  {
    href: "/algorithm",
    label: "วิธีคัดหุ้น",
    match: (p: string) => p.startsWith("/algorithm"),
  },
];

export default function Navbar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center gap-1 px-4 py-3">
        <Link href="/" className="mr-4 flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">
            US Stocks <span className="text-lv-entry">SMC</span> Scanner
          </span>
        </Link>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              l.match(pathname)
                ? "bg-grid text-ink"
                : "text-ink-2 hover:bg-grid/60 hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        ))}
        <AlertCenter />
      </nav>
    </header>
  );
}
