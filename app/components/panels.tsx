import Link from "next/link";
import { delta, fmt, type Unit } from "@/lib/metrics";
import { AFTER_HOURS_BANDS, BANDS, DAYS_OF_WEEK, pct, type CustomMetric, type DashboardData } from "@/lib/dashboard";
import { Icon } from "./icons";

export function Delta({ cur, prev, unit, higherIsBetter = true, days }: { cur: number | null; prev: number | null; unit: Unit; higherIsBetter?: boolean; days: number }) {
  const d = delta(cur, prev, unit, higherIsBetter);
  return (
    <span className={`delta ${d.tone}`}>
      <Icon name={d.dir} size={15} />
      <b>{d.text}</b> <span>vs previous {days} days</span>
    </span>
  );
}

/** Sparkline: area + line, current point emphasised. */
export function Spark({ values }: { values: number[] }) {
  const W = 220, H = 44;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [values.length === 1 ? W / 2 : (i / (values.length - 1)) * W, H - 4 - (v / max) * (H - 10)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1] ?? [0, H];
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`${line} L${W},${H} L0,${H} Z`} className="spark-area" />
      <path d={line} className="spark-line" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r="3" className="spark-dot" />
    </svg>
  );
}

export function Meter({ value, max, tone = "qualified" }: { value: number; max: number; tone?: string }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return <div className={`meter m-${tone}`}><i style={{ width: `${w}%` }} /></div>;
}

export function KpiCards({ d }: { d: DashboardData }) {
  const { cur, prev, days, series } = d;
  const totals = series.map((b) => b.qualified + b.not_fit + b.complaint + b.unclear);
  const cost = cur.cost ?? 0;
  const [rupees, paise] = fmt(cost, "inr").split(".");
  return (
    <section className="kpis" aria-label="Key numbers">
      <article className="card kpi">
        <header><h3>Calls answered</h3><span className="kpi-icon i-blue"><Icon name="calls" /></span></header>
        <div className="kpi-value">{fmt(cur.calls, "count")}</div>
        <Spark values={totals.length ? totals : [0]} />
        <footer><Delta cur={cur.calls} prev={prev.calls} unit="count" days={days} /></footer>
      </article>
      <article className="card kpi">
        <header><h3>Qualified leads</h3><span className="kpi-icon i-green"><Icon name="check" /></span></header>
        <div className="kpi-value">{fmt(cur.qualified, "count")}<small> of {fmt(cur.calls, "count")} calls</small></div>
        <Meter value={cur.qualified ?? 0} max={cur.calls ?? 0} />
        <p className="kpi-sub">{pct(cur.qualified, cur.calls)} qualified · {fmt(cur.not_fit, "count")} closed kindly</p>
        <footer><Delta cur={cur.qualified} prev={prev.qualified} unit="count" days={days} /></footer>
      </article>
      <article className="card kpi">
        <header><h3>Consultations</h3><span className="kpi-icon i-amber"><Icon name="calendar" /></span></header>
        <div className="kpi-split">
          <div><div className="kpi-value">{fmt(cur.booked, "count")}</div><span>Booked on the call</span><Meter value={cur.booked ?? 0} max={cur.qualified ?? 0} tone="notfit" /></div>
          <div><div className="kpi-value">{fmt(cur.showed_up, "count")}</div><span>Showed up</span><Meter value={cur.showed_up ?? 0} max={cur.booked ?? 0} tone="ink" /></div>
        </div>
        <footer><Delta cur={cur.booked} prev={prev.booked} unit="count" days={days} /></footer>
      </article>
      <article className="card kpi">
        <header><h3>Running cost</h3><span className="kpi-icon i-brick"><Icon name="rupee" /></span></header>
        <div className="kpi-value">{rupees}{paise ? <small className="paise">.{paise}</small> : null}</div>
        <p className="kpi-sub">{fmt(cur.voice_minutes, "min")} of voice · {cur.qualified ? fmt(cost / cur.qualified, "inr") : "–"} per qualified lead</p>
        <footer><Delta cur={cur.cost} prev={prev.cost} unit="inr" higherIsBetter={false} days={days} /></footer>
      </article>
    </section>
  );
}

export function MetricCard({ m, days, compact = false }: { m: CustomMetric; days: number; compact?: boolean }) {
  const onTrack = m.target != null && m.value != null ? (m.higher_is_better ? m.value >= m.target : m.value <= m.target) : null;
  return (
    <article className="card metric">
      <header>
        <h3>{m.name}</h3>
        {!compact ? <Link href={`/metrics?days=${days}#${m.id}`} className="link-sm" aria-label={`Edit ${m.name}`}>Edit</Link> : null}
      </header>
      <div className="kpi-value">{fmt(m.value, m.unit)}</div>
      {m.target != null ? (
        <>
          <Meter value={m.value ?? 0} max={m.target} tone={onTrack ? "good" : "warn"} />
          <p className="kpi-sub">
            Target {m.higher_is_better ? "at least" : "at most"} {fmt(m.target, m.unit)} ·{" "}
            <span className={onTrack ? "ok" : "off"}>{m.value == null ? "no data yet" : onTrack ? "on track" : "below target"}</span>
          </p>
        </>
      ) : null}
      {!compact ? <footer><Delta cur={m.value} prev={m.prev} unit={m.unit} higherIsBetter={m.higher_is_better} days={days} /></footer> : null}
    </article>
  );
}

const STATUS = [
  { key: "qualified", label: "Qualified", icon: "check", tone: "qualified" },
  { key: "not_fit", label: "Not a fit", icon: "x", tone: "notfit" },
  { key: "complaint", label: "Complaint", icon: "alert", tone: "complaint" },
  { key: "unclear", label: "Unclear or review", icon: "help", tone: "unclear" },
] as const;

export function LeadStatus({ d }: { d: DashboardData }) {
  const c = d.cur;
  const n = { qualified: c.qualified ?? 0, not_fit: c.not_fit ?? 0, complaint: c.complaint ?? 0, unclear: c.unclear ?? 0 };
  const total = Object.values(n).reduce((a, b) => a + b, 0);
  const sub: Record<string, string> = {
    qualified: `${fmt(c.booked, "count")} booked · ${fmt(c.claimed, "count")} claimed by a designer`,
    not_fit: "Closed kindly on the call, logged",
    complaint: "Sent to the front desk to call back",
    unclear: "Dropped calls, or the AI step needs a look",
  };
  return (
    <>
      <div className="segbar" role="img" aria-label={STATUS.map((s) => `${s.label} ${n[s.key]}`).join(", ")}>
        {total === 0 ? <i className="seg-empty" /> : STATUS.map((s) => (n[s.key] ? <i key={s.key} className={`seg-${s.tone}`} style={{ flexGrow: n[s.key] }} /> : null))}
      </div>
      <ul className="status-list">
        {STATUS.map((s) => (
          <li key={s.key}>
            <span className={`status-icon t-${s.tone}`}><Icon name={s.icon} size={16} /></span>
            <span className="status-text"><b>{s.label}</b><small>{sub[s.key]}</small></span>
            <span className="status-n">{n[s.key]}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function Donut({ value, max, label }: { value: number; max: number; label: string }) {
  const r = 26, C = 2 * Math.PI * r;
  const p = max > 0 ? value / max : 0;
  return (
    <svg className="donut" viewBox="0 0 64 64" role="img" aria-label={label}>
      <circle cx="32" cy="32" r={r} className="donut-track" />
      <circle cx="32" cy="32" r={r} className="donut-fill" strokeDasharray={`${(p * C).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 32 32)" />
      <text x="32" y="36.5" textAnchor="middle" className="donut-text">{max > 0 ? `${Math.round(p * 100)}%` : "–"}</text>
    </svg>
  );
}

export function Heatmap({ grid }: { grid: number[][] }) {
  const max = Math.max(0, ...grid.flat());
  const level = (v: number) => (v === 0 ? 0 : Math.max(1, Math.ceil((v / Math.max(1, max)) * 5)));
  return (
    <div className="heat-wrap">
      <table className="heat">
        <thead><tr><th scope="col"><span className="sr">Time</span></th>{DAYS_OF_WEEK.map((d) => <th key={d} scope="col">{d}</th>)}</tr></thead>
        <tbody>
          {BANDS.map((b, i) => (
            <tr key={b}>
              <th scope="row">{b}{AFTER_HOURS_BANDS.has(i) ? <em>after hours</em> : null}</th>
              {grid[i].map((v, j) => (
                <td key={j} className={`h${level(v)}`} title={`${DAYS_OF_WEEK[j]}, ${b}: ${v} call${v === 1 ? "" : "s"}`}>{v || ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="heat-legend" aria-hidden="true"><span>Fewer</span>{[0, 1, 2, 3, 4, 5].map((l) => <i key={l} className={`h${l}`} />)}<span>More</span></div>
    </div>
  );
}

export function ReasonBars({ reasons }: { reasons: DashboardData["reasons"] }) {
  const max = Math.max(1, ...reasons.map((r) => r.n));
  return (
    <ul className="bars">
      {reasons.map((r) => (
        <li key={r.k}>
          <span className="bar-label">{r.label}</span>
          <span className="bar-track"><i style={{ width: `${(r.n / max) * 100}%` }} /></span>
          <span className="bar-n">{r.n}</span>
        </li>
      ))}
    </ul>
  );
}
