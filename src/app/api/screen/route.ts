import { NextResponse } from "next/server";
import { runScreen } from "@/lib/screener";

export const dynamic = "force-dynamic";
// Cold-cache screening makes ~35+ upstream calls; allow the full
// Vercel Hobby-plan window instead of the default serverless timeout
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const force = new URL(req.url).searchParams.get("force") === "1";
    const result = await runScreen(force);
    return NextResponse.json(result);
  } catch (err) {
    console.error("screen failed:", err);
    return NextResponse.json(
      { error: "screening pipeline failed" },
      { status: 500 }
    );
  }
}
