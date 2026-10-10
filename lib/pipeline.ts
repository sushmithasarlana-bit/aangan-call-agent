import { sql } from "./db";
import { env, numEnv, optionalEnv } from "./env";
import { eventKind, payloadShape, readVaani } from "./vaani";
import { classify, type ClassifyOutput } from "./classify";
import { formatTurns, type Turn } from "./transcript";
import { isAfterHours, fmtIST } from "./hours";
import { renderEmail, sendEmail } from "./email";
import { createDeal } from "./hubspot";
import { actionUrl } from "./links";

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/**
 * One Vaani webhook in, everything downstream out. Safe to call twice for the same event:
 * call_started only fills blanks, and call_postprocessing takes a one-time latch
 * (processed_at) before classifying, so a retry never sends a second email.
 */
export async function handleVaaniEvent(payload: unknown) {
  const ev = readVaani(payload);
  const kind = eventKind(ev.event);
  console.log("vaani event", JSON.stringify({ event: ev.event, kind, callId: ev.callId, shape: payloadShape(payload) }));

  // Test pings, ringing, picked-up and other lifecycle events: acknowledge and move on.
  if (kind === "other") return { status: 200, body: { ok: true, ignored: ev.event } };
  if (!ev.callId) {
    // Nothing to store without an id (a sample test payload, or an unexpected format: see the shape log above).
    console.warn("vaani event without call id", ev.event);
    return { status: 200, body: { ok: true, ignored: "no call id (room_name / call_id)" } };
  }
  const db = sql();
  const raw = JSON.stringify(payload);

  if (kind === "started") {
    const startedAt = ev.startedAt ?? ev.at ?? new Date();
    await db`
      insert into calls (vaani_call_id, caller_number, status, started_at, after_hours, last_payload)
      values (${ev.callId}, ${ev.callerNumber}, 'in_progress', ${iso(startedAt)}, ${isAfterHours(startedAt)}, ${raw}::jsonb)
      on conflict (vaani_call_id) do update set
        caller_number = coalesce(calls.caller_number, excluded.caller_number),
        started_at    = coalesce(calls.started_at, excluded.started_at),
        after_hours   = coalesce(calls.after_hours, excluded.after_hours)`;
    return { status: 200, body: { ok: true, stored: "call_started" } };
  }

  // 1. Log the call (fills in whatever call_started didn't).
  const endedAt = ev.endedAt ?? ev.at ?? new Date();
  const [row] = (await db`
    insert into calls (vaani_call_id, caller_number, status, started_at, ended_at, recording_url, summary,
                       collected, transcript, booked_slot, last_payload)
    values (${ev.callId}, ${ev.callerNumber}, 'completed', ${iso(ev.startedAt)}, ${iso(endedAt)}, ${ev.recordingUrl},
            ${ev.summary}, ${JSON.stringify(ev.entities)}::jsonb, ${JSON.stringify(ev.transcript)}::jsonb,
            ${iso(ev.bookedSlot)}, ${raw}::jsonb)
    on conflict (vaani_call_id) do update set
      caller_number = coalesce(excluded.caller_number, calls.caller_number),
      status        = 'completed',
      started_at    = coalesce(calls.started_at, excluded.started_at),
      ended_at      = coalesce(excluded.ended_at, calls.ended_at),
      recording_url = coalesce(excluded.recording_url, calls.recording_url),
      summary       = coalesce(excluded.summary, calls.summary),
      collected     = excluded.collected,
      transcript    = excluded.transcript,
      booked_slot   = coalesce(excluded.booked_slot, calls.booked_slot),
      last_payload  = excluded.last_payload
    where calls.processed_at is null
    returning id, caller_number, started_at`) as { id: string; caller_number: string | null; started_at: string | null }[];
  // Already processed: a retry. Leave the stored call untouched.
  if (!row) return { status: 200, body: { ok: true, duplicate: true } };

  // 2. Duration: Vaani sometimes omits call_duration, so fall back to end minus start.
  const startedAt = row.started_at ? new Date(row.started_at) : ev.durationSec ? new Date(endedAt.getTime() - ev.durationSec * 1000) : endedAt;
  const derived = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);
  const durationSec = ev.durationSec ?? (derived > 0 && derived < 3 * 3600 ? derived : 0);
  const voiceCost = (durationSec / 60) * numEnv("VAANI_RATE_INR_PER_MIN", 5);

  // 3. Idempotency latch: only the first delivery of this call goes on.
  const latched = await db`
    update calls set processed_at = now(), started_at = ${iso(startedAt)}, duration_sec = ${durationSec},
      after_hours = ${isAfterHours(startedAt)}, cost_voice_inr = ${voiceCost}
    where id = ${row.id} and processed_at is null
    returning id`;
  if (latched.length === 0) return { status: 200, body: { ok: true, duplicate: true } };

  const callerNumber = ev.callerNumber ?? row.caller_number;
  const turns = ev.transcript;
  // A line that drops mid-sentence ("Hi, I wanted to inquire about —") has nothing to classify.
  const callerWords = turns.filter((t) => t.role === "caller").reduce((n, t) => n + t.text.split(/\s+/).length, 0);
  if (callerWords < 8) {
    await db`update calls set classification = 'unclear', fit_reason = 'Call dropped before the caller described a project.' where id = ${row.id}`;
    return { status: 200, body: { ok: true, classification: "unclear" } };
  }

  // 4. Classify. If the AI step fails, the lead still reaches a human with the raw transcript.
  let out: ClassifyOutput;
  try {
    out = await classify({ turns, callTime: startedAt, callerNumber, summary: ev.summary, entities: ev.entities });
  } catch (e: any) {
    const errors: string[] = [];
    try {
      await sendEmail({
        to: env("FRONT_DESK_EMAIL"),
        subject: `Review needed: call from ${callerNumber ?? "unknown number"} (AI step failed)`,
        ...rawCallEmail("The AI step failed, so this call was not classified. Please read it and call back if it's a lead.", callerNumber, startedAt, durationSec, turns, ev.recordingUrl),
      });
    } catch (mailErr: any) {
      errors.push(mailErr.message);
    }
    await db`update calls set ai_error = ${String(e?.message ?? e).slice(0, 1000)}, output_errors = ${errors} where id = ${row.id}`;
    return { status: 200, body: { ok: true, ai_error: true } };
  }

  const r = out.result;
  const slot = ev.bookedSlot ?? (r.booked_slot_iso ? new Date(r.booked_slot_iso) : null);

  // 5. Route qualified leads: matching specialty, fewest leads this week.
  let designer: { id: string; name: string; email: string | null } | null = null;
  if (r.classification === "qualified") {
    const [d] = (await db`
      select d.id, d.name, d.email from designers d
      where d.active and (${r.segment} = 'unknown' or ${r.segment} = any(d.specialties))
      order by (select count(*) from calls c where c.designer_id = d.id and c.created_at > now() - interval '7 days'), d.created_at
      limit 1`) as any[];
    designer = d ?? null;
  }

  // 6. Outputs. Each is best-effort, so one failing service never blocks the others.
  const errors: string[] = [];
  let emailId: string | null = null;
  let dealId: string | null = null;
  let handoffAt: string | null = null;
  const L = r.lead;
  const who = L.name ?? "New caller";

  if (r.classification === "qualified") {
    const bookingUrl = optionalEnv("CALCOM_BOOKING_URL");
    const { html, text } = renderEmail({
      heading: slot ? `New consultation: ${fmtIST(slot)}` : "New qualified lead (no slot booked yet)",
      facts: [
        ["Client", who],
        ["Phone", callerNumber ?? L.phone],
        ["Area", L.area],
        ["Property", [L.property_type, L.size_sqft ? `~${L.size_sqft} sq ft` : null, L.rented ? "rented" : null].filter(Boolean).join(", ")],
        ["Scope", L.scope],
        ["Timeline", L.timeline],
        ["Decision-maker", L.decision_maker],
        ["Budget", L.budget_volunteered ? `Caller volunteered: ${L.budget_volunteered}` : "Not discussed"],
        ["Asked about price", r.asked_pricing ? "Yes. Deflected to you at the consultation." : "No"],
        ["Check", r.uncertainties.join("; ") || null],
        ["Call", `${fmtIST(startedAt)}${isAfterHours(startedAt) ? " (after hours)" : ""}, ${Math.round(durationSec / 60)} min`],
        ["Assigned to", designer?.name ?? "Unassigned: first to claim takes it"],
      ],
      note: r.handoff_note,
      buttons: [
        { label: "Claim this lead", url: actionUrl(row.id, "claim") },
        { label: "Reschedule", url: actionUrl(row.id, "reschedule") },
        ...(bookingUrl ? [{ label: "Booking link for client", url: bookingUrl }] : []),
        ...(ev.recordingUrl ? [{ label: "Recording", url: ev.recordingUrl }] : []),
      ],
      footer: "No price was given on the call. Pricing is yours to discuss at the consultation.",
    });
    try {
      emailId = await sendEmail({
        to: designer?.email ?? env("FRONT_DESK_EMAIL"),
        subject: slot
          ? `New consultation ${fmtIST(slot)}: ${who}, ${L.property_type ?? "interiors"}, ${L.area ?? "Pune"}`
          : `Qualified lead, no slot yet: ${who}, ${L.property_type ?? "interiors"}, ${L.area ?? "Pune"}`,
        html,
        text,
      });
      handoffAt = new Date().toISOString();
    } catch (e: any) {
      errors.push(e.message);
    }
    try {
      dealId = await createDeal({
        name: [who, L.property_type, L.area].filter(Boolean).join(" · "),
        description: r.handoff_note,
        closeDate: iso(slot),
      });
    } catch (e: any) {
      errors.push(e.message);
    }
  } else if (r.classification === "complaint") {
    try {
      emailId = await sendEmail({
        to: env("FRONT_DESK_EMAIL"),
        subject: `Complaint, call back first thing: ${who} (${callerNumber ?? "number not captured"})`,
        ...rawCallEmail(`${r.fit_reason}\n\n${r.handoff_note}`, callerNumber, startedAt, durationSec, turns, ev.recordingUrl),
      });
      handoffAt = new Date().toISOString();
    } catch (e: any) {
      errors.push(e.message);
    }
  }
  // not_fit and unclear: logged only (the dashboard shows them).

  await db`
    update calls set
      classification = ${r.classification}, fit_reason = ${r.fit_reason}, asked_pricing = ${r.asked_pricing},
      segment = ${r.segment}, handoff_note = ${r.handoff_note},
      lead = ${JSON.stringify({ ...L, failed_criterion: r.failed_criterion, uncertainties: r.uncertainties, model: out.model, price_lines_stripped: out.priceLinesStripped.length })}::jsonb,
      booked_slot = coalesce(booked_slot, ${iso(slot)}), designer_id = ${designer?.id ?? null},
      email_message_id = ${emailId}, hubspot_deal_id = ${dealId}, handoff_sent_at = ${handoffAt},
      output_errors = ${errors}, cost_llm_inr = ${out.costInr}
    where id = ${row.id}`;

  return {
    status: 200,
    body: { ok: true, classification: r.classification, designer: designer?.name ?? null, emailed: !!emailId, deal: dealId, errors },
  };
}

function rawCallEmail(intro: string, callerNumber: string | null, startedAt: Date, durationSec: number, turns: Turn[], recordingUrl: string | null) {
  return renderEmail({
    heading: "A call needs a human",
    facts: [
      ["Caller", callerNumber ?? "Number not captured"],
      ["Call", `${fmtIST(startedAt)}${isAfterHours(startedAt) ? " (after hours)" : ""}, ${Math.round(durationSec / 60)} min`],
    ],
    note: `${intro}\n\nTranscript:\n${formatTurns(turns)}`,
    buttons: recordingUrl ? [{ label: "Recording", url: recordingUrl }] : [],
  });
}
