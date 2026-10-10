import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { csvResponse, toCsv } from "@/lib/csv";
import { pickDays } from "@/lib/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One row per day in the range, including days with no calls. Behind the dashboard password. */
export async function GET(req: NextRequest) {
  const days = pickDays(req.nextUrl.searchParams.get("days") ?? undefined);
  const rows = (await sql()`
    with d as (
      select generate_series((now() at time zone 'Asia/Kolkata')::date - (${days}::int - 1), (now() at time zone 'Asia/Kolkata')::date, '1 day')::date as day
    )
    select to_char(d.day, 'YYYY-MM-DD') as day, coalesce(m.calls, 0) as calls, coalesce(m.after_hours_calls, 0) as after_hours,
      coalesce(m.qualified, 0) as qualified, coalesce(m.booked, 0) as booked, coalesce(m.showed_up, 0) as showed_up,
      coalesce(m.won, 0) as won, coalesce(m.won_value_inr, 0) as won_value_inr, coalesce(m.cost_inr, 0) as cost_inr
    from d left join daily_metrics m on m.day = d.day
    order by d.day desc`) as any[];

  const body = toCsv(["Day", "Calls", "After hours", "Qualified", "Booked", "Showed up", "Won", "Won value (INR)", "Cost (INR)"],
    rows.map((r) => [r.day, r.calls, r.after_hours, r.qualified, r.booked, r.showed_up, r.won, r.won_value_inr, r.cost_inr]));
  const today = new Date().toISOString().slice(0, 10);
  return csvResponse(`aangan-daily-last-${days}-days-${today}.csv`, body);
}
