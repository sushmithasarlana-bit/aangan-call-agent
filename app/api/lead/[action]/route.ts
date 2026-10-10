import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { env, optionalEnv } from "@/lib/env";
import { LEAD_ACTIONS, verifyLink, type LeadAction } from "@/lib/links";
import { renderEmail, sendEmail } from "@/lib/email";
import { page } from "@/lib/page";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ action: string }> };

const COPY: Record<LeadAction, { title: string; button: string }> = {
  claim: { title: "Claim this lead?", button: "Yes, it's mine" },
  reschedule: { title: "Ask the front desk to reschedule this consultation?", button: "Yes, reschedule" },
};

async function check(req: NextRequest, ctx: Ctx, form?: FormData) {
  const { action } = await ctx.params;
  const get = (k: string) => String(form?.get(k) ?? req.nextUrl.searchParams.get(k) ?? "");
  const id = get("id");
  const ok = (LEAD_ACTIONS as readonly string[]).includes(action) && verifyLink(id, action, get("exp"), get("sig"));
  return { ok, action: action as LeadAction, id, exp: get("exp"), sig: get("sig"), name: get("name").trim().slice(0, 80) };
}

/**
 * GET only shows a confirm page. Email link scanners open every link, so nothing changes
 * until a person presses the button (POST).
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const c = await check(req, ctx);
  if (!c.ok) return page("Link expired", "<p>This link is invalid or has expired. Ask the front desk to resend it.</p>", 403);
  const [call] = (await sql()`select lead->>'name' as name, lead->>'area' as area, claimed_by from calls where id = ${c.id}`) as any[];
  if (!call) return page("Not found", "<p>That lead no longer exists.</p>", 404);
  const lead = [call.name, call.area].filter(Boolean).join(", ") || "this caller";
  return page(
    COPY[c.action].title,
    `<p>Lead: <strong>${escapeHtml(lead)}</strong></p>
     ${c.action === "claim" && call.claimed_by ? `<p>Already claimed by <strong>${escapeHtml(call.claimed_by)}</strong>.</p>` : ""}
     <form method="post">
       <input type="hidden" name="id" value="${escapeHtml(c.id)}"><input type="hidden" name="exp" value="${escapeHtml(c.exp)}"><input type="hidden" name="sig" value="${escapeHtml(c.sig)}">
       <label>Your name<br><input name="name" required maxlength="80" autocomplete="name"></label>
       <button type="submit">${COPY[c.action].button}</button>
     </form>`,
  );
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const c = await check(req, ctx, await req.formData());
  if (!c.ok) return page("Link expired", "<p>This link is invalid or has expired.</p>", 403);
  if (!c.name) return page("Name needed", "<p>Go back and enter your name.</p>", 400);
  const db = sql();

  if (c.action === "claim") {
    const won = await db`update calls set claimed_by = ${c.name}, claimed_at = now() where id = ${c.id} and claimed_by is null returning id`;
    if (won.length) return page("Claimed", `<p>The lead is yours, ${escapeHtml(c.name)}. Call them before the consultation.</p>`);
    const [row] = (await db`select claimed_by from calls where id = ${c.id}`) as any[];
    return page("Already claimed", `<p>${escapeHtml(row?.claimed_by ?? "Someone")} claimed this lead first.</p>`, 409);
  }

  const [row] = (await db`
    update calls set reschedule_requested_at = now() where id = ${c.id}
    returning caller_number, lead->>'name' as name, booked_slot`) as any[];
  const booking = optionalEnv("CALCOM_BOOKING_URL");
  try {
    await sendEmail({
      to: env("FRONT_DESK_EMAIL"),
      subject: `Reschedule requested by ${c.name}: ${row?.name ?? "caller"} (${row?.caller_number ?? "no number"})`,
      ...renderEmail({
        heading: "A designer asked to reschedule a consultation",
        facts: [["Designer", c.name], ["Client", row?.name], ["Phone", row?.caller_number], ["Booked slot", row?.booked_slot], ["Booking link", booking]],
        footer: "Call the client with two new slots, or send them the booking link.",
      }),
    });
  } catch (e) {
    console.error("reschedule email failed", e);
  }
  return page(
    "Reschedule requested",
    `<p>Thanks, ${escapeHtml(c.name)}. The front desk will offer the client new slots.</p>${booking ? `<p>Booking link to share: <a href="${escapeHtml(booking)}">${escapeHtml(booking)}</a></p>` : ""}`,
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}
