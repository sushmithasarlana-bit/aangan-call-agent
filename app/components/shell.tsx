import Link from "next/link";
import { fmtIST } from "@/lib/hours";
import type { Profile } from "@/lib/dashboard";
import { Avatar } from "./avatar";
import { CourtyardMark, Icon } from "./icons";
import { ThemeToggle } from "./theme-toggle";

const REPO = "https://github.com/sushmithasarlana-bit/aangan-call-agent";

type Active = "dashboard" | "metrics" | "profile";

export function Shell(props: {
  active: Active;
  profile: Profile;
  days: number;
  q?: string;
  callsInRange?: number;
  today?: { today_calls: number; today_after: number; today_qualified: number; designers: number };
  children: React.ReactNode;
}) {
  const { active, profile, days, q = "", today } = props;
  const nav = (href: string, icon: string, label: string, on = false, badge?: number | string, external = false) => (
    <Link key={label} href={href} className={`nav-item${on ? " on" : ""}`} aria-current={on ? "page" : undefined}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
      <Icon name={icon} />
      <span>{label}</span>
      {badge !== undefined ? <em>{badge}</em> : external ? <Icon name="ext" size={14} className="ext" /> : null}
    </Link>
  );

  return (
    <div className="app">
      <aside className="side" aria-label="Main navigation">
        <Link href="/" className="brand">
          <span className="brand-mark"><CourtyardMark size={22} /></span>
          <span className="brand-text">Aangan<small>Call agent</small></span>
        </Link>

        <nav className="nav">
          <p className="nav-h">Front desk</p>
          {nav(`/?days=${days}`, "dashboard", "Dashboard", active === "dashboard")}
          {nav(`/?days=${days}#calls`, "calls", "Recent calls", false, props.callsInRange)}
          {nav(`/?days=${days}#when`, "heat", "When calls arrive")}
          <p className="nav-h">Insights</p>
          {nav(`/metrics?days=${days}`, "status", "Your metrics", active === "metrics")}
          {nav(`/report?days=${days}`, "file", "Meeting summary")}
          <p className="nav-h">Downloads</p>
          <a className="nav-item" href={`/reports/calls.csv?days=${days}`} download><Icon name="calls" /><span>Calls (CSV)</span><Icon name="down" size={14} className="ext" /></a>
          <a className="nav-item" href={`/reports/daily.csv?days=${days}`} download><Icon name="calendar" /><span>Daily summary (CSV)</span><Icon name="down" size={14} className="ext" /></a>
          <p className="nav-h">Project</p>
          {nav(`${REPO}/blob/main/evals/results.md`, "check", "Eval: 10/10", false, undefined, true)}
          {nav(`${REPO}/blob/main/docs/component-map.png`, "map", "Component map", false, undefined, true)}
        </nav>

        {today ? (
          <div className="today" aria-label="Today">
            <div className="today-row"><span>Today</span><b>{today.today_calls} call{today.today_calls === 1 ? "" : "s"}</b></div>
            <div className="meter"><i style={{ width: `${today.today_calls ? (today.today_after / today.today_calls) * 100 : 0}%` }} /></div>
            <p>{today.today_after} after hours · {today.today_qualified} qualified</p>
          </div>
        ) : null}

        <Link href="/profile" className={`me${active === "profile" ? " on" : ""}`}>
          <Avatar name={profile.name} photo={profile.photo} size={38} />
          <span><b>{profile.name}</b><small>{profile.role}, Aangan Studio</small></span>
        </Link>
      </aside>

      <div className="main">
        <header className="top">
          <div className="studio">
            <span className="studio-icon"><CourtyardMark size={16} /></span>
            <span><b>Aangan Studio</b><small>Pune &amp; PCMC{today ? ` · ${today.designers} designer${today.designers === 1 ? "" : "s"}` : ""}</small></span>
          </div>
          <form className="search" action="/" method="get" role="search">
            <Icon name="search" />
            <input type="hidden" name="days" value={days} />
            <input name="q" defaultValue={q} placeholder="Search caller, area or number" aria-label="Search calls" />
          </form>
          <div className="top-right">
            <span className="date-chip"><Icon name="calendar" size={16} /> Today <b>{fmtIST(new Date(), { hour: undefined, minute: undefined })}</b></span>
            <ThemeToggle />
            <Link href="/profile" className="top-me" aria-label="Your profile">
              <Avatar name={profile.name} photo={profile.photo} size={36} />
              <span><b>{profile.name}</b><small>{profile.role}</small></span>
            </Link>
          </div>
        </header>
        <main className="content" id="top">{props.children}</main>
      </div>
    </div>
  );
}
