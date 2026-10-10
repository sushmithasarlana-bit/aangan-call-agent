import crypto from "node:crypto";
import { toTurns, type Turn } from "./transcript";

/**
 * Vaani AI (app.vaanivoice.ai) webhooks are unsigned, so the webhook URL carries a secret:
 * /api/vaani/webhook?token=<VAANI_WEBHOOK_SECRET>. Compared in constant time.
 */
export function tokenOk(token: string | null, secret: string): boolean {
  if (!token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** "call_started", "Call Started", "call.started" all mean the same event. */
export function eventKind(event: string): "started" | "final" | "other" {
  const e = event.toLowerCase().replace(/[^a-z]/g, "");
  if (e === "callstarted") return "started";
  if (e === "callpostprocessing" || e === "postprocessing" || e === "callpostprocessed") return "final";
  return "other";
}

/** Field names only (never values: they include phone numbers), for debugging the payload shape. */
export function payloadShape(payload: any): Record<string, string[]> {
  const shape: Record<string, string[]> = { top: Object.keys(payload ?? {}) };
  for (const k of ["data", "call", "call_details"]) {
    if (payload?.[k] && typeof payload[k] === "object") shape[k] = Object.keys(payload[k]);
  }
  return shape;
}

export type VaaniEvent = {
  event: string;
  callId: string | null;
  callerNumber: string | null;
  at: Date | null; // event timestamp
  startedAt: Date | null;
  endedAt: Date | null;
  durationSec: number | null; // null when Vaani omits it
  summary: string | null;
  entities: Record<string, unknown>;
  transcript: Turn[];
  recordingUrl: string | null;
  bookedSlot: Date | null;
};

/** First non-empty value among dotted paths. */
function pick(obj: any, ...paths: string[]): any {
  for (const p of paths) {
    const v = p.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

const date = (v: unknown): Date | null => {
  if (v == null || v === "") return null;
  const d = typeof v === "number" ? new Date(v < 1e12 ? v * 1000 : v) : new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Reads a Vaani webhook defensively: fields can sit at the top level or under data/call,
 * and not every event carries every field. call_duration is in milliseconds on
 * call_postprocessing and is sometimes missing; the pipeline then derives it from
 * call_started → end.
 */
export function readVaani(payload: any): VaaniEvent {
  const c = payload?.data ?? payload?.call ?? payload ?? {};
  const both = (...paths: string[]) => pick(c, ...paths) ?? pick(payload, ...paths);
  const event = String(both("event", "type", "event_type") ?? "unknown");

  const entities = { ...(both("entities") ?? {}), ...(both("collected_data", "collectedData") ?? {}) };
  const rawDur = Number(both("call_duration", "duration", "call_details.call_duration"));
  const durationSec = Number.isFinite(rawDur) && rawDur > 0
    ? Math.round(event === "call_postprocessing" || rawDur > 36_000 ? rawDur / 1000 : rawDur)
    : null;

  const slot = ["booked_slot", "appointment_time", "consultation_slot", "slot"]
    .map((k) => date(entities[k]))
    .find(Boolean) ?? date(both("appointment.startTime", "appointment.start"));

  return {
    event,
    callId: (both("room_name", "call_id", "callId", "id") as string | undefined) ?? null,
    callerNumber:
      (both("phone_number", "from", "caller_number", "customer_number", "caller.number") as string | undefined) ??
      ((entities.phone ?? entities.phone_number) as string | undefined) ??
      null,
    at: date(both("timestamp", "created_at", "createdAt")),
    startedAt: date(both("started_at", "startedAt", "start_time", "call_details.started_at")),
    endedAt: date(both("ended_at", "endedAt", "end_time", "call_details.ended_at")),
    durationSec,
    summary: (both("summary", "call_summary") as string | undefined) ?? null,
    entities,
    transcript: toTurns(both("transcript", "transcript.turns", "messages")),
    recordingUrl: (both("recording_url", "recordingUrl") as string | undefined) ?? null,
    bookedSlot: slot ?? null,
  };
}
