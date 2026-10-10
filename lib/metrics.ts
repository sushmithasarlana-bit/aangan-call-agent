import { sql } from "./db";

export type Unit = "count" | "inr" | "min" | "sec" | "pct";

/**
 * Every number on the dashboard comes from this catalog. Custom metrics pick from it by key,
 * so a metric definition never carries SQL. Fragments here are constants written in code.
 */
export const MEASURES = {
  calls: { label: "Calls answered", unit: "count", sql: "count(*)" },
  after_hours: { label: "After-hours calls", unit: "count", sql: "count(*) filter (where after_hours)" },
  qualified: { label: "Qualified leads", unit: "count", sql: "count(*) filter (where classification = 'qualified')" },
  not_fit: { label: "Not a fit", unit: "count", sql: "count(*) filter (where classification = 'not_fit')" },
  complaint: { label: "Complaints", unit: "count", sql: "count(*) filter (where classification = 'complaint')" },
  unclear: { label: "Unclear or in review", unit: "count", sql: "count(*) filter (where classification = 'unclear' or classification is null)" },
  booked: { label: "Consultations booked", unit: "count", sql: "count(*) filter (where booked_slot is not null)" },
  claimed: { label: "Leads claimed by a designer", unit: "count", sql: "count(*) filter (where claimed_by is not null)" },
  showed_up: { label: "Show-ups", unit: "count", sql: "count(*) filter (where showed_up)" },
  won: { label: "Projects won", unit: "count", sql: "count(*) filter (where project_won)" },
  asked_pricing: { label: "Callers who asked the price", unit: "count", sql: "count(*) filter (where asked_pricing)" },
  cost: { label: "Running cost (₹)", unit: "inr", sql: "coalesce(sum(cost_voice_inr + cost_llm_inr), 0)" },
  won_value: { label: "Value of projects won (₹)", unit: "inr", sql: "coalesce(sum(project_value_inr) filter (where project_won), 0)" },
  voice_minutes: { label: "Voice minutes", unit: "min", sql: "coalesce(sum(duration_sec), 0) / 60.0" },
  handoff_sec: { label: "Call end to designer email", unit: "sec", sql: "avg(extract(epoch from handoff_sent_at - ended_at)) filter (where handoff_sent_at is not null and ended_at is not null)" },
} as const satisfies Record<string, { label: string; unit: Unit; sql: string }>;

export type MeasureKey = keyof typeof MEASURES;
export type Totals = Record<MeasureKey, number | null>;
export const MEASURE_KEYS = Object.keys(MEASURES) as MeasureKey[];
export const COUNT_KEYS = MEASURE_KEYS.filter((k) => MEASURES[k].unit === "count");
export const isMeasure = (k: unknown): k is MeasureKey => typeof k === "string" && k in MEASURES;

/** All measures for the current window and the one before it, in a single query. */
export async function loadTotals(days: number): Promise<{ cur: Totals; prev: Totals }> {
  const cols = MEASURE_KEYS.map((k) => `(${MEASURES[k].sql})::float8 as "${k}"`).join(", ");
  const text = `
    with c as (select *, coalesce(started_at, created_at) as at from calls)
    select
      (select row_to_json(x) from (select ${cols} from c where at > now() - make_interval(days => $1::int)) x) as cur,
      (select row_to_json(x) from (select ${cols} from c
         where at <= now() - make_interval(days => $1::int) and at > now() - make_interval(days => $1::int * 2)) x) as prev`;
  const rows = (await sql().query(text, [days])) as { cur: Totals; prev: Totals }[];
  return rows[0];
}

export type MetricDef = {
  id: string;
  name: string;
  kind: "value" | "rate";
  measure: MeasureKey;
  denominator: MeasureKey | null;
  target: number | null;
  higher_is_better: boolean;
};

export async function loadMetricDefs(): Promise<MetricDef[]> {
  const rows = (await sql()`select id, name, kind, measure, denominator, target::float8 as target, higher_is_better
    from metrics order by position, created_at`) as MetricDef[];
  return rows.filter((r) => isMeasure(r.measure) && (r.kind === "value" || isMeasure(r.denominator)));
}

export function evaluate(def: Pick<MetricDef, "kind" | "measure" | "denominator">, t: Totals): { value: number | null; unit: Unit } {
  if (def.kind === "rate" && def.denominator) {
    const n = t[def.measure] ?? 0;
    const d = t[def.denominator] ?? 0;
    return { value: d > 0 ? (n / d) * 100 : null, unit: "pct" };
  }
  return { value: t[def.measure], unit: MEASURES[def.measure].unit };
}

export function describe(def: Pick<MetricDef, "kind" | "measure" | "denominator">): string {
  return def.kind === "rate" && def.denominator
    ? `${MEASURES[def.measure].label} ÷ ${MEASURES[def.denominator].label.toLowerCase()}`
    : MEASURES[def.measure].label;
}

export function fmt(v: number | null | undefined, unit: Unit): string {
  if (v == null || !Number.isFinite(v)) return "–";
  switch (unit) {
    case "inr":
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: v < 100 ? 2 : 0 }).format(v);
    case "min":
      return `${Math.round(v)} min`;
    case "sec":
      return v < 90 ? `${Math.round(v)} s` : `${(v / 60).toFixed(1)} min`;
    case "pct":
      return `${Math.round(v)}%`;
    default:
      return Math.round(v).toLocaleString("en-IN");
  }
}

/** Change against the previous window, coloured by whether up is good. */
export function delta(cur: number | null, prev: number | null, unit: Unit, higherIsBetter = true) {
  if (cur == null || prev == null) return { text: "No earlier data", tone: "flat" as const, dir: "flat" as const };
  const d = cur - prev;
  if (Math.abs(d) < 1e-9) return { text: "No change", tone: "flat" as const, dir: "flat" as const };
  const sign = d > 0 ? "+" : "−";
  const abs = Math.abs(d);
  const text = unit === "pct" ? `${sign}${Math.round(abs)} pts` : `${sign}${fmt(abs, unit)}`;
  const good = d > 0 === higherIsBetter;
  return { text, tone: good ? ("good" as const) : ("bad" as const), dir: d > 0 ? ("up" as const) : ("down" as const) };
}
