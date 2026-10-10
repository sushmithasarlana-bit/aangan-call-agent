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
  const text = await req.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    // Vaani's "Test Connectivity" may send an empty or non-JSON body: the token passed, so say yes.
    console.log("vaani webhook: non-JSON body", JSON.stringify({ length: text.length, contentType: req.headers.get("content-type") }));
    return NextResponse.json({ ok: true, ignored: "non-JSON body" });
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
