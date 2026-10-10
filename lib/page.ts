/** A tiny standalone HTML page for the email-link confirm and result screens, in the dashboard's materials. */
export function page(title: string, body: string, status = 200): Response {
  const t = title.replace(/[<>&]/g, "");
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${t} · Aangan</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@112,600&family=Instrument+Sans:wght@400;600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
:root{color-scheme:light;--bg:#ece5da;--paper:#f7f2ea;--line:#d8cbb9;--grid:rgba(110,75,46,.075);--ink:#26221f;--ink-2:#5b524a;--brick:#9c4228;--brick-ink:#fbf6f0;--teak:#6e4b2e}
@media (prefers-color-scheme:dark){:root{color-scheme:dark;--bg:#1a1816;--paper:#23201d;--line:#3a342f;--grid:rgba(214,170,130,.045);--ink:#efe7dc;--ink-2:#c6baac;--brick:#d9805f;--brick-ink:#1e1410;--teak:#c49a72}}
body{margin:0;background:var(--bg);background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);background-size:24px 24px;color:var(--ink);font:16px/1.55 "Instrument Sans",system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:460px;margin:0 auto;padding:48px 16px}
.card{background:var(--paper);border:1px solid var(--line);border-top:2px solid var(--brick);border-radius:6px;padding:24px}
.k{display:flex;gap:10px;align-items:center;margin:0 0 14px;font:500 11.5px/1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--teak)}
.k svg{width:22px;height:22px;fill:var(--brick)}
h1{font:600 22px/1.25 Archivo,system-ui,sans-serif;font-stretch:112%;margin:0 0 12px;text-wrap:balance}
p{color:var(--ink-2)}strong{color:var(--ink)}
label{display:block;margin:18px 0;font-weight:600;font-size:14px}
input{width:100%;box-sizing:border-box;padding:10px 12px;font:inherit;font-weight:400;border:1px solid var(--line);border-radius:4px;margin-top:6px;background:var(--bg);color:var(--ink)}
button{padding:11px 18px;font:600 15px/1 inherit;font-family:inherit;background:var(--brick);color:var(--brick-ink);border:0;border-radius:4px;cursor:pointer}
a{color:var(--brick)}:focus-visible{outline:2px solid var(--brick);outline-offset:2px}
</style></head>
<body><main><div class="card"><p class="k"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 3h26v26H18.5v-7h3.5V10H10v12h3.5v7H3z"/></svg>Aangan Studio</p><h1>${t}</h1>${body}</div></main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
