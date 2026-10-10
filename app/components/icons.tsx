/** Small line icons (20×20, currentColor). Safe in server and client components. */
const P: Record<string, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="6" height="6" rx="1.5" /><rect x="11" y="3" width="6" height="4" rx="1.5" /><rect x="11" y="9" width="6" height="8" rx="1.5" /><rect x="3" y="11" width="6" height="6" rx="1.5" /></>,
  calls: <path d="M6.5 3.5c.6 0 1.1 1.6 1.4 2.6.2.7-.6 1.2-.9 1.6.8 1.8 2.3 3.3 4.1 4.1.4-.3.9-1.1 1.6-.9 1 .3 2.6.8 2.6 1.4 0 1.3-1.2 2.7-2.6 2.7C8 15 4 11 4 6.1 4 4.7 5.2 3.5 6.5 3.5z" />,
  heat: <><rect x="3" y="3" width="4" height="4" rx="1" /><rect x="8" y="3" width="4" height="4" rx="1" /><rect x="13" y="3" width="4" height="4" rx="1" /><rect x="3" y="8" width="4" height="4" rx="1" /><rect x="8" y="8" width="4" height="4" rx="1" /><rect x="13" y="8" width="4" height="4" rx="1" /><rect x="3" y="13" width="4" height="4" rx="1" /><rect x="8" y="13" width="4" height="4" rx="1" /><rect x="13" y="13" width="4" height="4" rx="1" /></>,
  status: <><path d="M3 6.5 10 3l7 3.5-7 3.5z" /><path d="m3 10 7 3.5 7-3.5" /><path d="m3 13.5 7 3.5 7-3.5" /></>,
  reasons: <path d="M3 4h14l-5.5 6.5V16l-3-1.5v-4z" />,
  shield: <><path d="M10 2.5 16 5v4.5c0 4-2.7 6.7-6 8-3.3-1.3-6-4-6-8V5z" /><path d="m7.5 7.5 5 5" /></>,
  file: <><path d="M5 2.5h6.5L15 6v11.5H5z" /><path d="M11 2.5V6.5h4" /><path d="M7.5 10h5M7.5 13h5" /></>,
  map: <><path d="M3 5.5 7.5 3.5l5 2 4.5-2v11l-4.5 2-5-2L3 16.5z" /><path d="M7.5 3.5v11M12.5 5.5v11" /></>,
  check: <path d="m4.5 10.5 3.5 3.5 7.5-8" />,
  calendar: <><rect x="3" y="4.5" width="14" height="12.5" rx="2" /><path d="M3 8.5h14M7 2.5v4M13 2.5v4" /></>,
  rupee: <><path d="M5.5 4h9M5.5 7.5h9" /><path d="M8 4c4.5 0 4.5 7-1 7h-1.5l6.5 6" /></>,
  clock: <><circle cx="10" cy="10" r="7" /><path d="M10 6v4.5l3 1.5" /></>,
  search: <><circle cx="9" cy="9" r="5.5" /><path d="m13.2 13.2 4 4" /></>,
  moon: <path d="M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8z" />,
  sun: <><circle cx="10" cy="10" r="3.5" /><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4" /></>,
  ext: <path d="M8 4H4v12h12v-4M11 3h6v6M17 3l-8 8" />,
  user: <><circle cx="10" cy="7" r="3.5" /><path d="M3.5 17c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" /></>,
  x: <path d="m5 5 10 10M15 5 5 15" />,
  alert: <><path d="M10 3 18 17H2z" /><path d="M10 8v4M10 14.5v.5" /></>,
  help: <><circle cx="10" cy="10" r="7" /><path d="M8 8a2 2 0 1 1 2.5 1.9c-.4.2-.5.5-.5 1.1M10 13.8v.4" /></>,
  up: <path d="m4 14 5-5 3 3 5-6M13 6h4v4" />,
  down: <path d="m4 6 5 5 3-3 5 6M13 14h4v-4" />,
  flat: <path d="M4 10h12M13 7l3 3-3 3" />,
};

export function Icon({ name, size = 18, className }: { name: keyof typeof P | string; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name]}
    </svg>
  );
}

/** A plan of a courtyard house: walls around an open aangan, entered from the street side. */
export function CourtyardMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path fill="currentColor" d="M3 3h26v26H18.5v-7h3.5V10H10v12h3.5v7H3z" />
    </svg>
  );
}
