import { sql } from "./db";
import { evaluate, loadMetricDefs, loadTotals, type MetricDef, type Totals, type Unit } from "./metrics";
import type { Bucket } from "./series";

export const RANGES = [7, 30, 90] as const;
export const pickDays = (v?: string) => RANGES.find((d) => String(d) === v) ?? 30;

export const BANDS = ["Before 10am", "10am–1pm", "1–4pm", "4–7pm", "7–10pm", "After 10pm"] as const;
export const AFTER_HOURS_BANDS = new Set([0, 4, 5]);
export const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const REASONS: Record<string, string> = {
  service_area: "Outside Pune and PCMC",
  timeline: "Needed in under 6 weeks",
  budget: "Budget clearly too low",
  real_project: "Advice or decor only",
  out_of_scope: "Out of scope (restaurant, retail…)",
  decision_maker: "No decision-maker",
  other: "Other",
};

export type Profile = { name: string; role: string; email: string | null; photo: string | null };
export type CustomMetric = MetricDef & { value: number | null; prev: number | null; unit: Unit };

export async function loadProfile(): Promise<Profile> {
  const [p] = (await sql()`select name, role, email, photo from profile where id = 1`) as Profile[];
  return p ?? { name: "Nikhil Deshpande", role: "Founder", email: null, photo: null };
}

export async function loadDashboard(days: number, q = "") {
  const db = sql();
  const unit: "day" | "week" = days > 31 ? "week" : "day";
  const like = `%${q.replace(/[\\%_]/g, (m) => "\\" + m)}%`;

  const [totals, defs, profile, series, heat, reasons, calls, misc] = await Promise.all([
    loadTotals(days),
    loadMetricDefs(),
    loadProfile(),
    db`
      with b as (
        select generate_series(
          date_trunc(${unit}::text, (now() at time zone 'Asia/Kolkata') - make_interval(days => ${days - 1}::int)),
          date_trunc(${unit}::text, now() at time zone 'Asia/Kolkata'),
          ('1 ' || ${unit}::text)::interval) as bucket
      )
      select to_char(b.bucket, 'DD Mon') as label, to_char(b.bucket, 'Dy') as sub,
        count(c.id) filter (where c.classification = 'qualified')::int as qualified,
        count(c.id) filter (where c.classification = 'not_fit')::int as not_fit,
        count(c.id) filter (where c.classification = 'complaint')::int as complaint,
        count(c.id) filter (where c.classification = 'unclear' or (c.id is not null and c.classification is null))::int as unclear
      from b left join calls c
        on date_trunc(${unit}::text, coalesce(c.started_at, c.created_at) at time zone 'Asia/Kolkata') = b.bucket
      group by b.bucket order by b.bucket`,
    db`
      select extract(isodow from t)::int as dow,
        (case when extract(hour from t) < 10 then 0 when extract(hour from t) < 13 then 1 when extract(hour from t) < 16 then 2
              when extract(hour from t) < 19 then 3 when extract(hour from t) < 22 then 4 else 5 end)::int as band,
        count(*)::int as n
      from (select coalesce(started_at, created_at) at time zone 'Asia/Kolkata' as t from calls
            where coalesce(started_at, created_at) > now() - make_interval(days => ${days}::int)) x
      group by 1, 2`,
    db`
      select coalesce(nullif(lead->>'failed_criterion', ''), 'other') as k, count(*)::int as n from calls
      where classification = 'not_fit' and coalesce(started_at, created_at) > now() - make_interval(days => ${days}::int)
      group by 1`,
    db`
      select c.id, coalesce(c.started_at, c.created_at) as at, c.caller_number, c.duration_sec, c.after_hours,
        c.classification, c.fit_reason, c.asked_pricing, c.ai_error, c.booked_slot, c.claimed_by, c.showed_up,
        c.project_won, c.project_value_inr, (c.cost_voice_inr + c.cost_llm_inr)::float as cost,
        c.lead->>'name' as name, c.lead->>'area' as area, c.lead->>'property_type' as property, c.lead->>'scope' as scope,
        d.name as designer, coalesce(array_length(c.output_errors, 1), 0) as errors
      from calls c left join designers d on d.id = c.designer_id
      where coalesce(c.started_at, c.created_at) > now() - make_interval(days => ${days}::int)
        and (${q} = '' or concat_ws(' ', c.lead->>'name', c.lead->>'area', c.caller_number, c.fit_reason) ilike ${like})
      order by coalesce(c.started_at, c.created_at) desc limit 50`,
    db`
      with t as (select * from calls
                 where (coalesce(started_at, created_at) at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date)
      select (select count(*) from t)::int as today_calls,
        (select count(*) from t where after_hours)::int as today_after,
        (select count(*) from t where classification = 'qualified')::int as today_qualified,
        (select count(*) from designers where active)::int as designers`,
  ]);

  const heatGrid = BANDS.map((_, b) => DAYS_OF_WEEK.map((_, d) => (heat as any[]).find((h) => h.band === b && h.dow === d + 1)?.n ?? 0));
  const custom: CustomMetric[] = defs.map((def) => {
    const cur = evaluate(def, totals.cur);
    return { ...def, value: cur.value, prev: evaluate(def, totals.prev).value, unit: cur.unit };
  });

  return {
    days,
    unit,
    q,
    cur: totals.cur as Totals,
    prev: totals.prev as Totals,
    custom,
    profile,
    series: series as Bucket[],
    heatGrid,
    reasons: Object.keys(REASONS).map((k) => ({ k, label: REASONS[k], n: (reasons as any[]).find((r) => r.k === k)?.n ?? 0 })),
    calls: calls as any[],
    misc: misc[0] as { today_calls: number; today_after: number; today_qualified: number; designers: number },
  };
}

export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;

export const pct = (a: number | null, b: number | null) => (a != null && b ? `${Math.round((a / b) * 100)}%` : "–");

export function greeting(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(now));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "N";
