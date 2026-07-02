"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useScreen } from "@/components/useScreen";

// /graph lands on the top-ranked pick once the screen result is ready.
export default function GraphIndexPage() {
  const { data, error } = useScreen();
  const router = useRouter();

  useEffect(() => {
    const first = data?.picks[0]?.symbol;
    if (first) router.replace(`/graph/${first}`);
  }, [data, router]);

  return (
    <div className="flex flex-col items-center gap-3 py-24 text-ink-2">
      {error ? (
        <p className="text-sm">โหลดข้อมูลไม่สำเร็จ ({error})</p>
      ) : (
        <>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-grid border-t-lv-entry" />
          <p className="text-sm">กำลังเลือกหุ้นอันดับหนึ่งจากผลสแกน...</p>
        </>
      )}
    </div>
  );
}
