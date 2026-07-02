import { NextResponse } from "next/server";
import { fetchQuote } from "@/lib/yahoo";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { ticker: string } }
) {
  try {
    const quote = await fetchQuote(params.ticker.toUpperCase());
    return NextResponse.json(quote);
  } catch (err) {
    console.error(`quote ${params.ticker} failed:`, err);
    return NextResponse.json({ error: "quote failed" }, { status: 500 });
  }
}
