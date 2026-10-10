import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { csvResponse, toCsv } from "@/lib/csv";
import { pickDays } from "@/lib/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every call in the range, one row each. Behind the dashboard password (proxy.ts). */
export async function GET(req: NextRequest) {
  const days = pickDays(req.nextUrl.searchParams.get("days") ?? undefined);
  const rows = (await sql()`
    select to_char(coalesce(c.started_at, c.created_at) at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as at_ist,
      c.after_hours, c.duration_sec, c.caller_number, c.lead->>'name' as name, c.lead->>'area' as area,
      c.lead->>'property_type' as property, c.lead->>'scope' as scope, c.lead->>'timeline' as timeline,
      coalesce(c.classification, case when c.ai_error is not null then 'needs_review' else 'in_progress' end) as classification,
      c.lead->>'failed_criterion' as deciding_check, c.fit_reason, c.asked_pricing,
      to_char(c.booked_slot at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as consultation_ist,
      d.name as designer, c.claimed_by, c.showed_up, c.project_won, c.project_value_inr,
      round((c.cost_voice_inr + c.cost_llm_inr)::numeric, 2) as cost_inr
    from calls c left join designers d on d.id = c.designer_id
    where coalesce(c.started_at, c.created_at) > now() - make_interval(days => ${days}::int)
    order by coalesce(c.started_at, c.created_at) desc`) as any[];

  const header = ["Call time (IST)", "After hours", "Length (s)", "Caller number", "Name", "Area", "Property", "Scope", "Timeline",
    "Result", "Deciding check", "Reason", "Asked price", "Consultation (IST)", "Designer", "Claimed by", "Showed up", "Won", "Project value (INR)", "Cost (INR)"];
  const body = toCsv(header, rows.map((r) => [r.at_ist, r.after_hours, r.duration_sec, r.caller_number, r.name, r.area, r.property, r.scope,
    r.timeline, r.classification, r.deciding_check, r.fit_reason, r.asked_pricing, r.consultation_ist, r.designer, r.claimed_by,
    r.showed_up, r.project_won, r.project_value_inr, r.cost_inr]));
  const today = new Date().toISOString().slice(0, 10);
  return csvResponse(`aangan-calls-last-${days}-days-${today}.csv`, body);
}
