import { NextResponse } from "next/server";
import { fetchCandles, type ChartInterval } from "@/lib/yahoo";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { ticker: string } }
) {
  try {
    const url = new URL(req.url);
    const raw = url.searchParams.get("interval");
    const interval: ChartInterval = raw === "15m" ? "15m" : "1d";
    const candles = await fetchCandles(params.ticker.toUpperCase(), interval);
    return NextResponse.json({ candles, interval });
  } catch (err) {
    console.error(`history ${params.ticker} failed:`, err);
    return NextResponse.json({ error: "history failed" }, { status: 500 });
  }
}
