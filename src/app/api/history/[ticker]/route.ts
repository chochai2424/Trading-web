import { NextResponse } from "next/server";
import { fetchDailyCandles } from "@/lib/yahoo";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { ticker: string } }
) {
  try {
    const candles = await fetchDailyCandles(params.ticker.toUpperCase());
    return NextResponse.json({ candles });
  } catch (err) {
    console.error(`history ${params.ticker} failed:`, err);
    return NextResponse.json({ error: "history failed" }, { status: 500 });
  }
}
