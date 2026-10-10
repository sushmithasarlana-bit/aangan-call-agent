import Link from "next/link";
import { COUNT_KEYS, describe, evaluate, fmt, loadMetricDefs, loadTotals, MEASURE_KEYS, MEASURES, type MetricDef } from "@/lib/metrics";
import { loadProfile, pickDays } from "@/lib/dashboard";
import { createMetric, deleteMetric, moveMetric, updateMetric } from "../actions";
import { Shell } from "../components/shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your metrics · Aangan call agent" };

export default async function MetricsPage({ searchParams }: { searchParams: Promise<{ days?: string; error?: string; saved?: string; removed?: string }> }) {
  const sp = await searchParams;
  const days = pickDays(sp.days);
  const [defs, totals, profile] = await Promise.all([loadMetricDefs(), loadTotals(days), loadProfile()]);

  return (
    <Shell active="metrics" profile={profile} days={days}>
      <section className="hello">
        <div>
          <p className="eyebrow">Insights · last {days} days</p>
          <h1>Your metrics</h1>
          <p className="lede">Build the numbers you want on the dashboard from the call data: a single count, or one count as a share of another. Add a target to see at a glance whether you&apos;re on track.</p>
        </div>
        <div className="hello-actions">
          <Link className="btn" href={`/?days=${days}`}>Back to dashboard</Link>
          <a className="btn primary" href="#new">+ Add metric</a>
        </div>
      </section>

      {sp.error ? <p className="flash bad" role="alert">{sp.error}</p> : null}
      {sp.saved ? <p className="flash good" role="status">Saved “{sp.saved}”. It&apos;s on the dashboard now.</p> : null}
      {sp.removed ? <p className="flash good" role="status">Metric removed from the dashboard.</p> : null}

      <section className="card flush">
        <header className="card-head pad"><div><h2>On the dashboard</h2><p>{defs.length} metric{defs.length === 1 ? "" : "s"}, shown in this order</p></div></header>
        {defs.length === 0 ? <p className="empty">No metrics yet. Add one below.</p> : (
          <ul className="metric-rows">
            {defs.map((m, i) => {
              const v = evaluate(m, totals.cur);
              return (
                <li key={m.id} id={m.id}>
                  <details>
                    <summary>
                      <span className="mr-name"><b>{m.name}</b><small>{describe(m)}{m.target != null ? ` · target ${m.higher_is_better ? "≥" : "≤"} ${fmt(m.target, v.unit)}` : ""}</small></span>
                      <span className="mr-value">{fmt(v.value, v.unit)}</span>
                      <span className="btn sm">Edit</span>
                    </summary>
                    <MetricForm action={updateMetric} def={m} submit="Save changes" />
                    <div className="mr-tools">
                      <form action={moveMetric}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="dir" value="up" /><button className="btn sm ghost" disabled={i === 0}>Move up</button></form>
                      <form action={moveMetric}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="dir" value="down" /><button className="btn sm ghost" disabled={i === defs.length - 1}>Move down</button></form>
                      <form action={deleteMetric}><input type="hidden" name="id" value={m.id} /><button className="btn sm danger">Delete metric</button></form>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card" id="new">
        <header className="card-head"><div><h2>Add a metric</h2><p>It appears under “Your metrics” on the dashboard and in the meeting summary.</p></div></header>
        <MetricForm action={createMetric} submit="Add to dashboard" />
      </section>
    </Shell>
  );
}

function MetricForm({ action, def, submit }: { action: (f: FormData) => Promise<void>; def?: MetricDef; submit: string }) {
  const p = def?.id ?? "new";
  return (
    <form action={action} className="metric-form">
      {def ? <input type="hidden" name="id" value={def.id} /> : null}
      <label className="f-wide">Name
        <input id={`${p}-name`} name="name" required maxLength={60} defaultValue={def?.name} placeholder="e.g. Show-up rate" />
      </label>
      <fieldset className="f-wide">
        <legend>Type</legend>
        <label className="radio"><input type="radio" name="kind" value="value" defaultChecked={!def || def.kind === "value"} /> A single number <small>(count, ₹, minutes)</small></label>
        <label className="radio"><input type="radio" name="kind" value="rate" defaultChecked={def?.kind === "rate"} /> A rate <small>(one count as a % of another)</small></label>
      </fieldset>
      <label>Measure
        <select id={`${p}-measure`} name="measure" defaultValue={def?.measure ?? "qualified"}>
          {MEASURE_KEYS.map((k) => <option key={k} value={k}>{MEASURES[k].label}</option>)}
        </select>
      </label>
      <label className="f-den">Divided by <small>(rates only)</small>
        <select id={`${p}-denominator`} name="denominator" defaultValue={def?.denominator ?? "calls"}>
          {COUNT_KEYS.map((k) => <option key={k} value={k}>{MEASURES[k].label}</option>)}
        </select>
      </label>
      <label>Target <small>(optional; % for rates)</small>
        <input id={`${p}-target`} name="target" inputMode="decimal" defaultValue={def?.target ?? ""} placeholder="e.g. 70" />
      </label>
      <label>Good when it is
        <select id={`${p}-direction`} name="direction" defaultValue={def && !def.higher_is_better ? "lower" : "higher"}>
          <option value="higher">Higher</option>
          <option value="lower">Lower</option>
        </select>
      </label>
      <div className="f-wide form-actions"><button type="submit" className="btn primary">{submit}</button></div>
    </form>
  );
}
