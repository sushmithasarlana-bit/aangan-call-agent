"use client";

import { useState } from "react";

import { SERIES, type Bucket } from "@/lib/series";

function niceStep(max: number) {
  for (const s of [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500]) if (max / s <= 5) return s;
  return 1000;
}

/** A top-rounded bar segment anchored to the baseline. */
function topRounded(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

export function StackedBars({ data, unit }: { data: Bucket[]; unit: "day" | "week" }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 250, padL = 30, padR = 6, padT = 10, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const totals = data.map((d) => SERIES.reduce((s, x) => s + d[x.key], 0));
  const step = niceStep(Math.max(4, ...totals));
  const top = Math.max(step, Math.ceil(Math.max(4, ...totals) / step) * step);
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const slot = plotW / Math.max(1, data.length);
  const bw = Math.max(4, Math.min(30, slot * 0.6));
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const every = Math.ceil(data.length / 9);

  const h = hover !== null ? data[hover] : null;
  const tipLeft = hover !== null ? Math.min(88, Math.max(12, ((padL + hover * slot + slot / 2) / W) * 100)) : 0;

  return (
    <div className="chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Calls by ${unit}, stacked by result`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className={t === 0 ? "axis" : "grid"} />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" className="tick">{t}</text>
          </g>
        ))}
        {hover !== null && <rect x={padL + hover * slot + 1} y={padT} width={slot - 2} height={plotH} rx="6" className="hover-col" />}
        {data.map((d, i) => {
          const x = padL + i * slot + (slot - bw) / 2;
          let acc = 0;
          const segs = SERIES.filter((s) => d[s.key] > 0);
          return (
            <g key={i} opacity={hover === null || hover === i ? 1 : 0.55}>
              {segs.map((s, j) => {
                const v = d[s.key];
                const y1 = y(acc + v);
                const y0 = y(acc);
                acc += v;
                const gap = j > 0 ? 2 : 0; // 2px surface gap between stacked segments
                const hh = Math.max(1, y0 - y1 - gap);
                return j === segs.length - 1
                  ? <path key={s.key} d={topRounded(x, y1, bw, hh, 4)} fill={s.color} />
                  : <rect key={s.key} x={x} y={y1} width={bw} height={hh} fill={s.color} />;
              })}
            </g>
          );
        })}
        {data.map((d, i) =>
          i === data.length - 1 || (i % every === 0 && data.length - 1 - i >= Math.ceil(every * 0.75)) ? (
            <text key={`l${i}`} x={padL + i * slot + slot / 2} y={H - 8} textAnchor="middle" className="tick">{d.label}</text>
          ) : null,
        )}
        {data.map((_, i) => (
          <rect key={`h${i}`} x={padL + i * slot} y={padT} width={slot} height={plotH + padB} fill="transparent"
            onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
        ))}
      </svg>
      {h && (
        <div className="tip" style={{ left: `${tipLeft}%` }} role="status">
          <div className="tip-head">{unit === "week" ? `Week of ${h.label}` : `${h.sub}, ${h.label}`}</div>
          {SERIES.map((s) => (
            <div key={s.key} className="tip-row">
              <i style={{ background: s.color }} />
              <span>{s.label}</span>
              <b>{h[s.key]}</b>
            </div>
          ))}
          <div className="tip-total"><span>Total calls</span><b>{totals[hover!]}</b></div>
        </div>
      )}
    </div>
  );
}
