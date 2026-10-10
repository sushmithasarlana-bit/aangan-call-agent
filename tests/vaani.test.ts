import { test } from "node:test";
import assert from "node:assert/strict";
import { eventKind, readVaani } from "../lib/vaani.ts";

// Shape of a real Vaani call_postprocessing webhook (Oct 2026), with made-up values.
const postprocessing = {
  event: "call_postprocessing",
  call_id: "outbound-123",
  timestamp: "2026-10-10T17:32:54Z",
  to: "+910000000000",
  from: "+911111111111",
  data: {
    room_name: "outbound-123",
    call_id: "outbound-123",
    phone_number: "+919800000000",
    call_duration: 224.02,
    call_started_at: "2026-10-10T17:28:49.226453+00:00",
    call_ended_at: "2026-10-10T17:32:49.049192+00:00",
    summary: "Caller wants full interiors.",
    entities: { "Caller First Name": "Test" },
    recording_url: "https://example.com/rec.mp3",
    transcript: "[17:29:01] AGENT: Hi, thanks for calling Aangan Studio.\n[17:29:05] USER: I have a 3BHK in Baner.",
  },
};

test("reads a real-shape call_postprocessing payload", () => {
  const ev = readVaani(postprocessing);
  assert.equal(eventKind(ev.event), "final");
  assert.equal(ev.callId, "outbound-123");
  assert.equal(ev.callerNumber, "+919800000000");
  assert.equal(ev.durationSec, 224); // seconds, not milliseconds
  assert.equal(ev.startedAt?.toISOString(), "2026-10-10T17:28:49.226Z");
  assert.equal(ev.endedAt?.toISOString(), "2026-10-10T17:32:49.049Z");
  assert.deepEqual(ev.transcript.map((t) => t.role), ["agent", "caller"]);
});

test("a millisecond duration is still understood", () => {
  assert.equal(readVaani({ event: "call_postprocessing", data: { room_name: "x", call_duration: 224020 } }).durationSec, 224);
});

test("event names match loosely; lifecycle events are 'other'", () => {
  assert.equal(eventKind("Call Started"), "started");
  assert.equal(eventKind("call.postprocessing"), "final");
  for (const e of ["call_ringing", "user_picked_up_at", "webhook_test"]) assert.equal(eventKind(e), "other");
});
