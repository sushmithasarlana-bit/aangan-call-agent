/** A tiny standalone HTML page for the email-link confirm and result screens. */
export function page(title: string, body: string, status = 200): Response {
  const t = title.replace(/[<>&]/g, "");
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${t} · Aangan</title>
<style>body{margin:0;background:#f6f3ee;color:#2b2622;font:16px/1.5 -apple-system,Segoe UI,Roboto,sans-serif}main{max-width:440px;margin:0 auto;padding:40px 16px}
h1{font-size:22px;margin:0 0 16px}label{display:block;margin:16px 0}input{width:100%;box-sizing:border-box;padding:10px;font:inherit;border:1px solid #d8cfc4;border-radius:6px;margin-top:4px}
button{padding:12px 18px;font:inherit;background:#7a4b2a;color:#fff;border:0;border-radius:6px;cursor:pointer}a{color:#7a4b2a}
.k{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a7a68;margin:0 0 4px}</style></head>
<body><main><p class="k">Aangan Studio</p><h1>${t}</h1>${body}</main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
