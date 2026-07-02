import { NextResponse } from "next/server";
import { fetchNews } from "@/lib/yahoo";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { ticker: string } }
) {
  try {
    const news = await fetchNews(params.ticker.toUpperCase());
    return NextResponse.json({ news });
  } catch (err) {
    console.error(`news ${params.ticker} failed:`, err);
    return NextResponse.json({ error: "news failed" }, { status: 500 });
  }
}
