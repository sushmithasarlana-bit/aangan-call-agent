import { sql } from "@/lib/db";
import { fmtIST } from "@/lib/hours";
import { markShowedUp, markWon } from "./actions";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90] as const;
const LABEL: Record<string, string> = {
  qualified: "Qualified",
  not_fit: "Not a fit",
  complaint: "Complaint",
  unclear: "Unclear",
};

const inr = (n: number, compact = false) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: n < 100 && !compact ? 2 : 0,
    notation: compact && n >= 100000 ? "compact" : "standard",
  }).format(n);
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");
const dur = (s: number | null) => (s == null ? "–" : s < 90 ? `${Math.round(s)} s` : `${(s / 60).toFixed(1)} min`);

type Kpis = {
  calls: number; after_hours: number; qualified: number; not_fit: number; complaints: number; unclear: number;
  booked: number; showed_up: number; won: number; won_value: number; cost: number; asked_pricing: number;
  avg_handoff: number | null; minutes: number;
};

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams;
  const days = RANGES.find((d) => String(d) === sp.days) ?? 30;
  const db = sql();

  const [kpiRows, daily, calls] = await Promise.all([
    db`
      select count(*)::int as calls,
        count(*) filter (where after_hours)::int as after_hours,
        count(*) filter (where classification = 'qualified')::int as qualified,
        count(*) filter (where classification = 'not_fit')::int as not_fit,
        count(*) filter (where classification = 'complaint')::int as complaints,
        count(*) filter (where classification = 'unclear')::int as unclear,
        count(*) filter (where booked_slot is not null)::int as booked,
        count(*) filter (where showed_up)::int as showed_up,
        count(*) filter (where project_won)::int as won,
        coalesce(sum(project_value_inr) filter (where project_won), 0)::float as won_value,
        coalesce(sum(cost_voice_inr + cost_llm_inr), 0)::float as cost,
        count(*) filter (where asked_pricing)::int as asked_pricing,
        (avg(extract(epoch from handoff_sent_at - ended_at)) filter (where handoff_sent_at is not null and ended_at is not null))::float as avg_handoff,
        coalesce(sum(duration_sec), 0)::float / 60 as minutes
      from calls where coalesce(started_at, created_at) > now() - make_interval(days => ${days})`,
    db`select * from daily_metrics where day > (now() at time zone 'Asia/Kolkata')::date - ${days}::int limit 14`,
    db`
      select c.id, coalesce(c.started_at, c.created_at) as at, c.caller_number, c.duration_sec, c.after_hours,
        c.classification, c.fit_reason, c.asked_pricing, c.ai_error, c.booked_slot, c.claimed_by, c.showed_up,
        c.project_won, c.project_value_inr, (c.cost_voice_inr + c.cost_llm_inr)::float as cost,
        c.lead->>'name' as name, c.lead->>'area' as area, c.lead->>'property_type' as property, d.name as designer,
        coalesce(array_length(c.output_errors, 1), 0) as errors
      from calls c left join designers d on d.id = c.designer_id
      where coalesce(c.started_at, c.created_at) > now() - make_interval(days => ${days})
      order by coalesce(c.started_at, c.created_at) desc limit 50`,
  ]);
  const k = kpiRows[0] as Kpis;

  return (
    <main>
      <div className="head">
        <div>
          <p className="kicker">Aangan Studio</p>
          <h1>Call agent dashboard</h1>
          <p className="sub">Every call answered, qualified against Nikhil&apos;s rubric and handed to a designer.</p>
        </div>
        <nav className="filters" aria-label="Date range">
          {RANGES.map((d) => (
            <a key={d} href={`/?days=${d}`} aria-current={d === days ? "page" : undefined}>
              {d} days
            </a>
          ))}
        </nav>
      </div>

      <section className="hero" aria-label="Calls answered">
        <span className="value">{k.calls.toLocaleString("en-IN")}</span>
        <span className="label">
          calls answered in the last {days} days, <strong>{k.after_hours}</strong> of them ({pct(k.after_hours, k.calls)}) outside
          front-desk hours (10am–7pm)
        </span>
      </section>

      <section className="tiles" aria-label="Results">
        <Tile label="Qualified" value={k.qualified} note={`${pct(k.qualified, k.calls)} of calls · ${k.not_fit} not a fit`} />
        <Tile label="Consultations booked" value={k.booked} note={`${pct(k.booked, k.qualified)} of qualified`} />
        <Tile label="Showed up" value={k.showed_up} note={`${pct(k.showed_up, k.booked)} of booked`} />
        <Tile label="Projects won" value={k.won} note={k.won_value ? `${inr(k.won_value, true)} in projects` : "Mark wins below"} />
        <Tile label="Running cost" value={inr(k.cost)} note={`${Math.round(k.minutes)} voice min · ${k.qualified ? inr(k.cost / k.qualified) : "–"} per qualified lead`} />
        <Tile label="Call end to designer email" value={dur(k.avg_handoff)} note="Average, qualified leads and complaints" />
        <Tile label="Asked about price" value={k.asked_pricing} note="All deflected to the designer. 0 quoted." />
        <Tile label="Complaints to a human" value={k.complaints} note={`${k.unclear} unclear call${k.unclear === 1 ? "" : "s"} logged`} />
      </section>

      <h2>Recent calls</h2>
      <div className="table-wrap">
        {calls.length === 0 ? (
          <p className="empty">No calls yet in this range. Make a Vaani test call, or run scripts/send-test-webhook.mjs.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>When (IST)</th><th>Caller</th><th className="num">Length</th><th>Result</th><th>Why</th>
                <th>Designer</th><th>Slot</th><th className="num">Cost</th><th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c: any) => (
                <tr key={c.id}>
                  <td className="nowrap">
                    {fmtIST(c.at)}
                    {c.after_hours ? <> <span className="pill">after hours</span></> : null}
                  </td>
                  <td>
                    {c.name ?? <span className="dim">Unknown</span>}
                    <div className="dim nowrap">{[c.caller_number, c.area].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="num">{dur(c.duration_sec)}</td>
                  <td>
                    <Badge c={c} />
                    {c.asked_pricing ? <div><span className="pill">asked price</span></div> : null}
                  </td>
                  <td className="reason">
                    {c.ai_error
                      ? c.errors > 0
                        ? "AI step failed and the front-desk email failed too. Read the transcript in the database and call back."
                        : "AI step failed; raw transcript emailed to the front desk."
                      : c.fit_reason ?? <span className="dim">Processing…</span>}
                    {c.errors > 0 && !c.ai_error ? <div className="dim">{c.errors} output error(s), see the database row</div> : null}
                  </td>
                  <td>
                    {c.designer ?? <span className="dim">–</span>}
                    {c.claimed_by ? <div className="dim">Claimed by {c.claimed_by}</div> : null}
                  </td>
                  <td className="nowrap">{c.booked_slot ? fmtIST(c.booked_slot) : <span className="dim">–</span>}</td>
                  <td className="num">{inr(c.cost ?? 0)}</td>
                  <td>
                    {c.classification === "qualified" ? (
                      c.project_won ? (
                        <span>Won{c.project_value_inr ? ` · ${inr(Number(c.project_value_inr), true)}` : ""}</span>
                      ) : (
                        <>
                          <form action={markShowedUp} className="inline">
                            <input type="hidden" name="id" value={c.id} />
                            <button type="submit">{c.showed_up ? "✓ Showed up" : "Mark showed up"}</button>
                          </form>
                          <form action={markWon} className="inline">
                            <input type="hidden" name="id" value={c.id} />
                            <input name="value" inputMode="numeric" placeholder="₹ value" aria-label="Project value in rupees" />
                            <button type="submit">Won</button>
                          </form>
                        </>
                      )
                    ) : (
                      <span className="dim">–</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2>By day</h2>
      <div className="table-wrap">
        {daily.length === 0 ? (
          <p className="empty">No days with calls in this range.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Day</th><th className="num">Calls</th><th className="num">After hours</th><th className="num">Qualified</th>
                <th className="num">Booked</th><th className="num">Showed up</th><th className="num">Won</th><th className="num">Cost</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((d: any) => (
                <tr key={String(d.day)}>
                  <td className="nowrap">{fmtIST(d.day, { hour: undefined, minute: undefined, timeZone: "UTC" })}</td>
                  <td className="num">{d.calls}</td>
                  <td className="num">{d.after_hours_calls}</td>
                  <td className="num">{d.qualified}</td>
                  <td className="num">{d.booked}</td>
                  <td className="num">{d.showed_up}</td>
                  <td className="num">{d.won}</td>
                  <td className="num">{inr(Number(d.cost_inr ?? 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="cut">
        <strong>The Cut:</strong> the agent never quotes a price. Callers who ask are told their designer will walk them through
        pricing at the consultation, and a code-level filter strips any price line from AI output before it is stored or emailed.
      </p>
    </main>
  );
}

function Tile({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="tile">
      <div className="label">{label}</div>
      <div className="value">{typeof value === "number" ? value.toLocaleString("en-IN") : value}</div>
      {note ? <div className="note">{note}</div> : null}
    </div>
  );
}

function Badge({ c }: { c: { classification: string | null; ai_error: string | null } }) {
  const key = c.classification ?? (c.ai_error ? "error" : "pending");
  const text = c.classification ? LABEL[c.classification] : c.ai_error ? "Needs review" : "In progress";
  return <span className={`badge b-${key}`}>{text}</span>;
}
