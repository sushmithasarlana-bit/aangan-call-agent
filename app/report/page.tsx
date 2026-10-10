import Link from "next/link";
import { fmtIST } from "@/lib/hours";
import { fmt } from "@/lib/metrics";
import { loadDashboard, pct, pickDays, RANGES } from "@/lib/dashboard";
import { Avatar } from "../components/avatar";
import { StackedBars } from "../components/charts";
import { SERIES } from "@/lib/series";
import { CourtyardMark, Icon } from "../components/icons";
import { LeadStatus, MetricCard, ReasonBars } from "../components/panels";
import { PrintButton } from "../components/print-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meeting summary · Aangan call agent" };

export default async function Report({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const days = pickDays((await searchParams).days);
  const d = await loadDashboard(days);
  const { cur, prev, profile } = d;
  const now = new Date();
  const from = new Date(now.getTime() - days * 86400000);
  const qualifiedLeads = d.calls.filter((c) => c.classification === "qualified").slice(0, 5);
  const topReason = [...d.reasons].sort((a, b) => b.n - a.n)[0];
  const unclaimed = Math.max(0, (cur.qualified ?? 0) - (cur.claimed ?? 0));
  const callDelta = (cur.calls ?? 0) - (prev.calls ?? 0);

  const points = [
    cur.calls ? `${fmt(cur.after_hours, "count")} of ${fmt(cur.calls, "count")} calls (${pct(cur.after_hours, cur.calls)}) came outside front-desk hours. Without the agent they would have waited for the next morning.` : `No calls in the last ${days} days.`,
    `${fmt(cur.qualified, "count")} qualified lead${cur.qualified === 1 ? "" : "s"}; ${fmt(cur.booked, "count")} booked a consultation during the call.`,
    cur.qualified ? (unclaimed ? `${unclaimed} qualified lead${unclaimed === 1 ? " is" : "s are"} not yet claimed by a designer.` : "Every qualified lead has been claimed by a designer.") : null,
    `${fmt(cur.asked_pricing, "count")} caller${cur.asked_pricing === 1 ? "" : "s"} asked about price. All were sent to the designer; no price was quoted.`,
    `Running cost ${fmt(cur.cost, "inr")}${cur.qualified ? `, about ${fmt((cur.cost ?? 0) / cur.qualified, "inr")} per qualified lead` : ""}.`,
    topReason && topReason.n ? `Most common reason a lead was closed: ${topReason.label.toLowerCase()} (${topReason.n}).` : null,
    prev.calls != null ? `Calls are ${callDelta === 0 ? "level with" : callDelta > 0 ? `up ${callDelta} on` : `down ${-callDelta} on`} the previous ${days} days.` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="report-page">
      <div className="report-bar">
        <Link className="btn" href={`/?days=${days}`}>← Dashboard</Link>
        <nav className="range" aria-label="Date range">
          {RANGES.map((r) => <Link key={r} href={`/report?days=${r}`} aria-current={r === days ? "page" : undefined}>{r} days</Link>)}
        </nav>
        <a className="btn" href={`/reports/calls.csv?days=${days}`} download><Icon name="down" size={16} /> Calls CSV</a>
        <PrintButton />
      </div>

      <article className="sheet" aria-label="One-page meeting summary">
        <header className="sheet-head">
          <div className="sheet-brand">
            <span className="brand-mark"><CourtyardMark size={20} /></span>
            <div>
              <p className="eyebrow">Aangan Studio · call agent</p>
              <h1>Meeting summary</h1>
              <p className="sheet-range">{fmtIST(from, { hour: undefined, minute: undefined, year: "numeric" })} – {fmtIST(now, { hour: undefined, minute: undefined, year: "numeric" })} · last {days} days</p>
            </div>
          </div>
          <div className="sheet-who">
            <Avatar name={profile.name} photo={profile.photo} size={40} />
            <div><b>{profile.name}</b><small>{profile.role}</small><small>Generated {fmtIST(now)}</small></div>
          </div>
        </header>

        <section className="sheet-kpis">
          <div><span>Calls answered</span><b>{fmt(cur.calls, "count")}</b><small>{pct(cur.after_hours, cur.calls)} after hours</small></div>
          <div><span>Qualified</span><b>{fmt(cur.qualified, "count")}</b><small>{pct(cur.qualified, cur.calls)} of calls</small></div>
          <div><span>Booked</span><b>{fmt(cur.booked, "count")}</b><small>{pct(cur.booked, cur.qualified)} of qualified</small></div>
          <div><span>Showed up</span><b>{fmt(cur.showed_up, "count")}</b><small>{pct(cur.showed_up, cur.booked)} of booked</small></div>
          <div><span>Won</span><b>{fmt(cur.won, "count")}</b><small>{cur.won_value ? fmt(cur.won_value, "inr") : "–"}</small></div>
          <div><span>Running cost</span><b>{fmt(cur.cost, "inr")}</b><small>{cur.qualified ? `${fmt((cur.cost ?? 0) / cur.qualified, "inr")} per lead` : "–"}</small></div>
        </section>

        <section className="sheet-grid">
          <div className="sheet-box wide">
            <h2>Calls by {d.unit}</h2>
            <ul className="legend">{SERIES.map((s) => <li key={s.key}><i style={{ background: s.color }} />{s.label}</li>)}</ul>
            <StackedBars data={d.series} unit={d.unit} />
          </div>
          <div className="sheet-box">
            <h2>Talking points</h2>
            <ul className="points">{points.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        </section>

        <section className="sheet-grid three">
          <div className="sheet-box"><h2>Lead status</h2><LeadStatus d={d} /></div>
          <div className="sheet-box"><h2>Why leads were closed</h2><ReasonBars reasons={d.reasons} /></div>
          <div className="sheet-box">
            <h2>Your metrics</h2>
            {d.custom.length ? <div className="sheet-metrics">{d.custom.slice(0, 4).map((m) => <MetricCard key={m.id} m={m} days={days} compact />)}</div> : <p className="small">No custom metrics.</p>}
          </div>
        </section>

        <section className="sheet-box">
          <h2>Qualified leads</h2>
          {qualifiedLeads.length ? (
            <table className="sheet-table">
              <thead><tr><th>Client</th><th>Area</th><th>Scope</th><th>Consultation</th><th>Designer</th></tr></thead>
              <tbody>
                {qualifiedLeads.map((c) => (
                  <tr key={c.id}>
                    <td><b>{c.name ?? "Unknown"}</b></td>
                    <td>{c.area ?? "–"}</td>
                    <td>{[c.property, c.scope].filter(Boolean).join(" · ") || "–"}</td>
                    <td>{c.booked_slot ? fmtIST(c.booked_slot) : "Not booked"}</td>
                    <td>{c.claimed_by ? `${c.claimed_by} (claimed)` : c.designer ?? "Unassigned"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="small">No qualified leads in this range.</p>}
        </section>

        <footer className="sheet-foot">
          <span><b>The Cut:</b> the agent never quotes a price; pricing is the designer&apos;s, at the consultation.</span>
          <span>Source: Aangan call agent · Neon calls table</span>
        </footer>
      </article>
    </div>
  );
}
