"use client";

import { useEffect, useState } from "react";
import type { NewsItem } from "@/lib/types";
import { fmtTimeTh } from "@/lib/format";

export default function NewsList({ symbol }: { symbol: string }) {
  const [news, setNews] = useState<NewsItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    setNews(null);
    fetch(`/api/news/${symbol}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((json) => alive && setNews(json.news ?? []))
      .catch(() => alive && setNews([]));
    return () => {
      alive = false;
    };
  }, [symbol]);

  return (
    <div className="rounded-lg border border-border bg-surface">
      <h3 className="border-b border-border px-4 py-3 text-sm font-semibold text-ink-2">
        ข่าวล่าสุด · {symbol}
      </h3>
      {news === null ? (
        <p className="px-4 py-6 text-sm text-muted">กำลังโหลดข่าว...</p>
      ) : news.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">ไม่พบข่าวสำหรับหุ้นนี้</p>
      ) : (
        <ul className="divide-y divide-grid">
          {news.map((n, i) => (
            <li key={i}>
              <a
                href={n.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 px-4 py-3 hover:bg-grid/40"
              >
                {n.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={n.thumbnail}
                    alt=""
                    className="h-14 w-20 flex-none rounded object-cover"
                  />
                )}
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm text-ink">{n.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    {n.publisher} · {fmtTimeTh(n.publishedAt)}
                  </p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
