import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { tokenOk } from "@/lib/vaani";
import { handleVaaniEvent } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Vaani posts every call event here: /api/vaani/webhook?token=<VAANI_WEBHOOK_SECRET> */
export async function POST(req: NextRequest) {
  if (!tokenOk(req.nextUrl.searchParams.get("token"), env("VAANI_WEBHOOK_SECRET"))) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Body is not JSON" }, { status: 400 });
  }
  try {
    const { status, body } = await handleVaaniEvent(payload);
    return NextResponse.json(body, { status });
  } catch (e: any) {
    // 500 lets Vaani retry; the processed_at latch makes the retry safe.
    console.error("vaani webhook failed", e);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
