import { NextResponse } from "next/server";
import { runScreen } from "@/lib/screener";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await runScreen();
    return NextResponse.json(result);
  } catch (err) {
    console.error("screen failed:", err);
    return NextResponse.json(
      { error: "screening pipeline failed" },
      { status: 500 }
    );
  }
}
