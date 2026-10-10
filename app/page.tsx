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
    db`select *, to_char(day, 'Dy, DD Mon') as label from daily_metrics where day > (now() at time zone 'Asia/Kolkata')::date - ${days}::int limit 14`,
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

  const stages = [
    { label: "Calls answered", value: k.calls, dim: `${k.after_hours} after hours · ${pct(k.after_hours, k.calls)}`, sub: "Day or night, every call" },
    { label: "Qualified", value: k.qualified, dim: `${pct(k.qualified, k.calls)} of calls`, sub: `${k.not_fit} not a fit, closed kindly` },
    { label: "Consultations booked", value: k.booked, dim: `${pct(k.booked, k.qualified)} of qualified`, sub: "Booked during the call" },
    { label: "Showed up", value: k.showed_up, dim: `${pct(k.showed_up, k.booked)} of booked`, sub: "Marked by the team below" },
    { label: "Projects won", value: k.won, dim: `${pct(k.won, k.showed_up)} of show-ups`, sub: k.won_value ? `${inr(k.won_value, true)} in projects` : "Mark wins below" },
  ];

  return (
    <main>
      <header className="sheet-head">
        <div className="brand">
          <CourtyardMark />
          <div>
            <p className="eyebrow">Aangan Studio · Pune</p>
            <h1>Call agent</h1>
            <p className="sub">Every call answered, qualified against Nikhil&apos;s rubric and handed to a designer.</p>
          </div>
        </div>
        <nav className="range" aria-label="Date range">
          {RANGES.map((d) => (
            <a key={d} href={`/?days=${d}`} aria-current={d === days ? "page" : undefined}>
              {d} days
            </a>
          ))}
        </nav>
      </header>

      <div className="titleblock" aria-label="Sheet details">
        <span>Range <b>last {days} days</b></span>
        <span>Front desk hours <b>10am–7pm IST</b></span>
        <span>Updated <b>{fmtIST(new Date())}</b></span>
      </div>

      <section className="panel" aria-labelledby="pipe-h">
        <div className="panel-head">
          <h2 id="pipe-h">From call to project</h2>
          <span className="mono">Each span shows the share carried forward</span>
        </div>
        <ol className="pipeline">
          {stages.map((s) => (
            <li className="stage" key={s.label}>
              <div className="dim"><span>{s.dim}</span></div>
              <div className="stage-label">{s.label}</div>
              <div className="stage-value">{s.value.toLocaleString("en-IN")}</div>
              <div className="stage-sub">{s.sub}</div>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel" aria-label="Operations">
        <dl className="ops">
          <div>
            <dt>Running cost</dt>
            <dd>{inr(k.cost)}</dd>
            <p>{Math.round(k.minutes)} voice min · {k.qualified ? inr(k.cost / k.qualified) : "–"} per qualified lead</p>
          </div>
          <div>
            <dt>Call end to designer email</dt>
            <dd>{dur(k.avg_handoff)}</dd>
            <p>Average, qualified leads and complaints</p>
          </div>
          <div>
            <dt>Asked about price</dt>
            <dd>{k.asked_pricing}</dd>
            <p>All sent to the designer. 0 quoted.</p>
          </div>
          <div>
            <dt>Complaints to a person</dt>
            <dd>{k.complaints}</dd>
            <p>{k.unclear} unclear call{k.unclear === 1 ? "" : "s"} logged</p>
          </div>
        </dl>
      </section>

      <section className="panel" aria-labelledby="calls-h">
        <div className="panel-head">
          <h2 id="calls-h">Recent calls</h2>
          <span className="mono">Latest {calls.length} · times in IST</span>
        </div>
        <div className="table-wrap">
          {calls.length === 0 ? (
            <p className="empty">No calls in this range yet. Make a Vaani test call, or run scripts/send-test-webhook.mjs.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>When</th><th>Caller</th><th className="num">Length</th><th>Result</th><th>Why</th>
                  <th>Designer</th><th>Slot</th><th className="num">Cost</th><th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c: any) => (
                  <tr key={c.id}>
                    <td>
                      <div className="when">{fmtIST(c.at)}</div>
                      {c.after_hours ? <span className="tag night">After hours</span> : null}
                    </td>
                    <td>
                      <div className="who">{c.name ?? <span className="muted">Unknown</span>}</div>
                      <div className="small nowrap">{[c.caller_number, c.area].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="num">{dur(c.duration_sec)}</td>
                    <td>
                      <Badge c={c} />
                      {c.asked_pricing ? <div><span className="tag">Asked price</span></div> : null}
                    </td>
                    <td className="reason">
                      {c.ai_error
                        ? c.errors > 0
                          ? "AI step failed and the front-desk email failed too. Read the transcript in the database and call back."
                          : "AI step failed; raw transcript emailed to the front desk."
                        : c.fit_reason ?? <span className="muted">Processing…</span>}
                      {c.errors > 0 && !c.ai_error ? <div className="small">{c.errors} output error(s), see the database row</div> : null}
                    </td>
                    <td>
                      {c.designer ?? <span className="muted">–</span>}
                      {c.claimed_by ? <div className="small">Claimed by {c.claimed_by}</div> : null}
                    </td>
                    <td className="when">{c.booked_slot ? fmtIST(c.booked_slot) : <span className="muted">–</span>}</td>
                    <td className="num">{inr(c.cost ?? 0)}</td>
                    <td>
                      {c.classification === "qualified" ? (
                        c.project_won ? (
                          <span className="won">Won{c.project_value_inr ? ` · ${inr(Number(c.project_value_inr), true)}` : ""}</span>
                        ) : (
                          <>
                            <form action={markShowedUp} className="inline">
                              <input type="hidden" name="id" value={c.id} />
                              <button type="submit" className="btn">{c.showed_up ? "✓ Showed up" : "Mark showed up"}</button>
                            </form>
                            <form action={markWon} className="inline">
                              <input type="hidden" name="id" value={c.id} />
                              <input name="value" className="field" inputMode="numeric" placeholder="₹ value" aria-label="Project value in rupees" />
                              <button type="submit" className="btn primary">Won</button>
                            </form>
                          </>
                        )
                      ) : (
                        <span className="muted">–</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="panel" aria-labelledby="day-h">
        <div className="panel-head">
          <h2 id="day-h">By day</h2>
          <span className="mono">Up to 14 days</span>
        </div>
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
                    <td className="when">{d.label}</td>
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
      </section>

      <aside className="note" aria-label="The Cut">
        <span className="mono">Note · the Cut</span>
        <p>
          The agent never quotes a price. Callers who ask are told their designer will walk them through pricing at the
          consultation, and a filter in the code strips any price line from AI output before it is stored or emailed.
        </p>
      </aside>

      <footer>
        <span>Aangan Studio · interior design for homes and offices · Pune and PCMC</span>
        <span>Aangan (आँगन): the courtyard at the centre of a home</span>
      </footer>
    </main>
  );
}

/** A plan of a courtyard house: walls around an open aangan, entered from the street side. */
function CourtyardMark() {
  return (
    <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
      <path className="wall" d="M3 3h26v26H18.5v-7h3.5V10H10v12h3.5v7H3z" />
    </svg>
  );
}

function Badge({ c }: { c: { classification: string | null; ai_error: string | null } }) {
  const key = c.classification ?? (c.ai_error ? "error" : "pending");
  const text = c.classification ? LABEL[c.classification] : c.ai_error ? "Needs review" : "In progress";
  return <span className={`badge b-${key}`}>{text}</span>;
}
