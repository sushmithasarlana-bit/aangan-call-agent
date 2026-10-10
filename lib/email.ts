import { env } from "./env";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Sends through Resend's REST API. Returns the message id. */
export async function sendEmail(msg: { to: string; subject: string; html: string; text: string }): Promise<string> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env("RESEND_API_KEY")}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env("EMAIL_FROM"), to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
    signal: AbortSignal.timeout(15_000),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend ${res.status}: ${json?.message ?? "send failed"}`);
  return json.id;
}

type Button = { label: string; url: string };

/** A plain, phone-friendly email: heading, fact table, the 8-line note, buttons. */
export function renderEmail(p: {
  heading: string;
  facts: [string, string | number | null | undefined][];
  note?: string;
  buttons?: Button[];
  footer?: string;
}): { html: string; text: string } {
  const facts = p.facts.filter(([, v]) => v !== null && v !== undefined && v !== "");
  const html = `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#2b2622">
<div style="max-width:560px;margin:0 auto;padding:20px 16px">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a7a68">Aangan Studio · call agent</p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${esc(p.heading)}</h1>
<table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;font-size:14px">
${facts.map(([k, v]) => `<tr><td style="padding:8px 12px;color:#8a7a68;width:34%;vertical-align:top;border-bottom:1px solid #eee6dc">${esc(k)}</td><td style="padding:8px 12px;border-bottom:1px solid #eee6dc">${esc(String(v))}</td></tr>`).join("")}
</table>
${p.note ? `<h2 style="margin:20px 0 8px;font-size:14px">Handoff note</h2><div style="background:#fff;border-radius:8px;padding:12px;font-size:14px;line-height:1.55;white-space:pre-line">${esc(p.note)}</div>` : ""}
${(p.buttons ?? []).length ? `<p style="margin:20px 0 0">${p.buttons!.map((b) => `<a href="${esc(b.url)}" style="display:inline-block;margin:0 8px 8px 0;padding:10px 16px;background:#7a4b2a;color:#fff;text-decoration:none;border-radius:6px;font-size:14px">${esc(b.label)}</a>`).join("")}</p>` : ""}
${p.footer ? `<p style="margin:20px 0 0;font-size:12px;color:#8a7a68">${esc(p.footer)}</p>` : ""}
</div></body></html>`;
  const text = [
    p.heading,
    "",
    ...facts.map(([k, v]) => `${k}: ${v}`),
    ...(p.note ? ["", "Handoff note:", p.note] : []),
    ...(p.buttons ?? []).map((b) => `${b.label}: ${b.url}`),
    ...(p.footer ? ["", p.footer] : []),
  ].join("\n");
  return { html, text };
}
