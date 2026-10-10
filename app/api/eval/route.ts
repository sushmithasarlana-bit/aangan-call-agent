import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { tokenOk } from "@/lib/vaani";
import { classify } from "@/lib/classify";
import { parseTranscript } from "@/lib/transcript";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Dry run: classify a past transcript. No database row, no email, no CRM deal.
 * POST /api/eval?token=<VAANI_WEBHOOK_SECRET>  {"id":"T02","transcript":"AGENT: …\nUSER: …","call_time":"2026-09-03T14:41:00+05:30"}
 */
export async function POST(req: NextRequest) {
  if (!tokenOk(req.nextUrl.searchParams.get("token"), env("VAANI_WEBHOOK_SECRET"))) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body.transcript !== "string") {
    return NextResponse.json({ error: 'Send {"transcript": "..."}' }, { status: 400 });
  }
  const turns = parseTranscript(body.transcript);
  const callTime = body.call_time && !isNaN(Date.parse(body.call_time)) ? new Date(body.call_time) : new Date();
  try {
    const out = await classify({ turns, callTime });
    return NextResponse.json({
      id: body.id ?? null,
      ...out.result,
      model: out.model,
      price_lines_stripped: out.priceLinesStripped,
    });
  } catch (e: any) {
    return NextResponse.json({ id: body.id ?? null, error: String(e?.message ?? e) }, { status: 502 });
  }
}
