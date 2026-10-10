import Link from "next/link";
import { fmtIST, isAfterHours } from "@/lib/hours";
import { fmt } from "@/lib/metrics";
import { greeting, loadDashboard, pickDays, RANGES } from "@/lib/dashboard";
import { markShowedUp, markWon } from "./actions";
import { StackedBars } from "./components/charts";
import { SERIES } from "@/lib/series";
import { Icon } from "./components/icons";
import { Donut, Heatmap, KpiCards, LeadStatus, MetricCard, ReasonBars } from "./components/panels";
import { Shell } from "./components/shell";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = { qualified: "Qualified", not_fit: "Not a fit", complaint: "Complaint", unclear: "Unclear" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ days?: string; q?: string }> }) {
  const sp = await searchParams;
  const days = pickDays(sp.days);
  const q = (sp.q ?? "").trim().slice(0, 80);
  const d = await loadDashboard(days, q);
  const { cur, profile } = d;
  const now = new Date();
  const first = profile.name.split(/\s+/)[0] || profile.name;
  const unclaimed = Math.max(0, (cur.qualified ?? 0) - (cur.claimed ?? 0));
  const totalCalls = d.series.reduce((s, b) => s + b.qualified + b.not_fit + b.complaint + b.unclear, 0);

  return (
    <Shell active="dashboard" profile={profile} days={days} q={q} callsInRange={cur.calls ?? 0} today={d.misc}>
      <section className="hello">
        <div>
          <p className="eyebrow">
            {fmtIST(now, { weekday: "long", day: "numeric", month: "long", hour: undefined, minute: undefined })} ·{" "}
            {isAfterHours(now) ? "front desk closed, the agent is answering" : "front desk open"}
          </p>
          <h1>{greeting(now)}, {first}</h1>
          <p className="lede">
            {fmt(cur.calls, "count")} call{cur.calls === 1 ? "" : "s"} answered in the last {days} days, {fmt(cur.after_hours, "count")} of them after hours.{" "}
            {fmt(cur.qualified, "count")} qualified and {fmt(cur.booked, "count")} booked during the call
            {unclaimed ? `; ${unclaimed} still waiting for a designer to claim.` : "."}
          </p>
        </div>
        <div className="hello-actions">
          <nav className="range" aria-label="Date range">
            {RANGES.map((r) => (
              <Link key={r} href={`/?days=${r}${q ? `&q=${encodeURIComponent(q)}` : ""}`} aria-current={r === days ? "page" : undefined}>{r} days</Link>
            ))}
          </nav>
          <a className="btn" href={`/reports/calls.csv?days=${days}`} download><Icon name="down" size={16} /> Download CSV</a>
          <Link className="btn primary" href={`/report?days=${days}`}><Icon name="file" size={16} /> Meeting summary</Link>
        </div>
      </section>

      <KpiCards d={d} />

      <section className="grid-2">
        <article className="card">
          <header className="card-head">
            <div><h2>Calls by {d.unit}</h2><p>Last {days} days, stacked by result · hover a bar for detail</p></div>
            <div className="card-total"><span>Calls in range</span><b>{totalCalls}</b></div>
          </header>
          <ul className="legend">{SERIES.map((s) => <li key={s.key}><i style={{ background: s.color }} />{s.label}</li>)}</ul>
          <StackedBars data={d.series} unit={d.unit} />
          <details className="data-table">
            <summary>Show data table</summary>
            <div className="table-scroll">
              <table>
                <thead><tr><th>{d.unit === "week" ? "Week of" : "Day"}</th>{SERIES.map((s) => <th key={s.key} className="num">{s.label}</th>)}<th className="num">Total</th></tr></thead>
                <tbody>
                  {d.series.map((b) => (
                    <tr key={b.label}>
                      <td>{d.unit === "week" ? b.label : `${b.sub}, ${b.label}`}</td>
                      {SERIES.map((s) => <td key={s.key} className="num">{b[s.key]}</td>)}
                      <td className="num"><b>{b.qualified + b.not_fit + b.complaint + b.unclear}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </article>

        <article className="card" id="status">
          <header className="card-head"><div><h2>Lead status</h2><p>Last {days} days · {fmt(cur.calls, "count")} calls</p></div></header>
          <LeadStatus d={d} />
          <div className="followup">
            <div>
              <b>Designer follow-up</b>
              <p>{fmt(cur.claimed, "count")} of {fmt(cur.qualified, "count")} qualified leads claimed · email {fmt(cur.handoff_sec, "sec")} after the call</p>
            </div>
            <Donut value={cur.claimed ?? 0} max={cur.qualified ?? 0} label="Share of qualified leads claimed by a designer" />
          </div>
        </article>
      </section>

      <section className="section" aria-labelledby="mine-h">
        <header className="section-head">
          <div><h2 id="mine-h">Your metrics</h2><p>Numbers you chose to track, with targets</p></div>
          <div className="section-actions">
            <Link className="btn" href={`/metrics?days=${days}`}><Icon name="status" size={16} /> Edit metrics</Link>
            <Link className="btn primary" href={`/metrics?days=${days}#new`}>+ Add metric</Link>
          </div>
        </header>
        {d.custom.length ? (
          <div className="metric-grid">{d.custom.map((m) => <MetricCard key={m.id} m={m} days={days} />)}</div>
        ) : (
          <p className="card empty">No metrics yet. <Link href="/metrics#new">Add your first one</Link>, for example a show-up rate with a 70% target.</p>
        )}
      </section>

      <section className="grid-2 even">
        <article className="card" id="when">
          <header className="card-head"><div><h2>When calls arrive</h2><p>Calls by day and time (IST) · front desk hours are 10am–7pm</p></div></header>
          <Heatmap grid={d.heatGrid} />
        </article>
        <article className="card" id="reasons">
          <header className="card-head"><div><h2>Why leads were closed</h2><p>The deciding check from Nikhil&apos;s rubric, for calls that were not a fit</p></div></header>
          <ReasonBars reasons={d.reasons} />
          <p className="foot-note">Asking about price never closes a lead. {fmt(cur.asked_pricing, "count")} caller{cur.asked_pricing === 1 ? "" : "s"} asked; every one was sent to the designer, and no price was quoted.</p>
        </article>
      </section>

      <article className="card flush" id="calls">
        <header className="card-head pad">
          <div><h2>Recent calls</h2><p>{q ? <>Matching “{q}” · <Link href={`/?days=${days}`}>clear search</Link></> : `Latest ${d.calls.length} · times in IST`}</p></div>
          <a className="link-sm" href={`/reports/calls.csv?days=${days}`} download>Download CSV</a>
        </header>
        <div className="table-scroll">
          {d.calls.length === 0 ? (
            <p className="empty">{q ? "No calls match that search." : "No calls in this range yet. Make a Vaani test call, or run scripts/send-test-webhook.mjs."}</p>
          ) : (
            <table className="calls">
              <thead>
                <tr><th>When</th><th>Caller</th><th className="num">Length</th><th>Result</th><th>Why</th><th>Designer</th><th>Slot</th><th className="num">Cost</th><th>Outcome</th></tr>
              </thead>
              <tbody>
                {d.calls.map((c) => (
                  <tr key={c.id}>
                    <td className="nowrap">{fmtIST(c.at)}{c.after_hours ? <div><span className="tag">After hours</span></div> : null}</td>
                    <td><b>{c.name ?? <span className="muted">Unknown</span>}</b><div className="small nowrap">{[c.caller_number, c.area].filter(Boolean).join(" · ")}</div></td>
                    <td className="num">{fmt(c.duration_sec, "sec")}</td>
                    <td>
                      <Badge c={c} />
                      {c.asked_pricing ? <div><span className="tag">Asked price</span></div> : null}
                    </td>
                    <td className="reason">
                      {c.ai_error
                        ? c.errors > 0 ? "AI step failed and the front-desk email failed too. Read the transcript in the database and call back." : "AI step failed; raw transcript emailed to the front desk."
                        : c.fit_reason ?? <span className="muted">Processing…</span>}
                    </td>
                    <td>{c.designer ?? <span className="muted">–</span>}{c.claimed_by ? <div className="small">Claimed by {c.claimed_by}</div> : null}</td>
                    <td className="nowrap">{c.booked_slot ? fmtIST(c.booked_slot) : <span className="muted">–</span>}</td>
                    <td className="num">{fmt(c.cost ?? 0, "inr")}</td>
                    <td>
                      {c.classification === "qualified" ? (
                        c.project_won ? (
                          <span className="won">Won{c.project_value_inr ? ` · ${fmt(Number(c.project_value_inr), "inr")}` : ""}</span>
                        ) : (
                          <>
                            <form action={markShowedUp} className="inline">
                              <input type="hidden" name="id" value={c.id} />
                              <button type="submit" className="btn sm">{c.showed_up ? "✓ Showed up" : "Mark showed up"}</button>
                            </form>
                            <form action={markWon} className="inline">
                              <input type="hidden" name="id" value={c.id} />
                              <input name="value" className="field sm" inputMode="numeric" placeholder="₹ value" aria-label="Project value in rupees" />
                              <button type="submit" className="btn sm primary">Won</button>
                            </form>
                          </>
                        )
                      ) : <span className="muted">–</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </article>

      <aside className="note" aria-label="The Cut">
        <Icon name="shield" />
        <p><b>The Cut.</b> The agent never quotes a price. Callers who ask are told their designer will walk them through pricing at the consultation, and a filter in the code strips any price line from AI output before it is stored or emailed.</p>
      </aside>
    </Shell>
  );
}

function Badge({ c }: { c: { classification: string | null; ai_error: string | null } }) {
  const key = c.classification ?? (c.ai_error ? "error" : "pending");
  const text = c.classification ? LABEL[c.classification] : c.ai_error ? "Needs review" : "In progress";
  return <span className={`badge b-${key}`}>{text}</span>;
}
