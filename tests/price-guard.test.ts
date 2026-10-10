import { test } from "node:test";
import assert from "node:assert/strict";
import { stripPrices, guardDeep } from "../lib/price-guard.ts";
import { parseTranscript } from "../lib/transcript.ts";

const caller = "I have a 1BHK in Kharadi, about 550 sq ft. My budget is 1 to 1.5 lakh maximum.";

test("strips studio price figures and per-sq-ft rates", () => {
  const note = [
    "Client: Riya, 2BHK Wakad, ~950 sq ft",
    "Typical cost would be ₹18–22 lakh",
    "Rates start at 1,800 per sq ft",
    "Standard spec is around ₹2,400/sq ft",
    "Asked for a ballpark twice; deflected to consultation",
  ].join("\n");
  const r = stripPrices(note, "I have a 2BHK in Wakad, 950 sq ft. How much would it cost?");
  assert.equal(r.stripped.length, 3);
  assert.match(r.text, /950 sq ft/);
  assert.match(r.text, /deflected/);
  assert.doesNotMatch(r.text, /lakh|per sq ft|\/sq ft/);
});

test("keeps the caller's own volunteered budget", () => {
  const r = stripPrices("Budget (caller said): 1–1.5 lakh for kitchen + bedroom", caller);
  assert.equal(r.stripped.length, 0);
});

test("strips a figure the caller never said, even next to their budget", () => {
  const r = stripPrices("Caller said 1.5 lakh; realistic scope needs 6 lakh", caller);
  assert.equal(r.stripped.length, 1);
});

test("areas, BHK counts, dates and phone numbers are not prices", () => {
  const r = stripPrices("3BHK, 1,400 sq ft, done by March, slot Thu 4:00 pm, +91 98000 00000", "");
  assert.equal(r.stripped.length, 0);
});

test("guardDeep walks nested output", () => {
  const { value, stripped } = guardDeep({ a: "fine", b: { c: "about Rs 5 lakh" }, d: ["₹3.5 lakh – ₹8 lakh"] }, "");
  assert.deepEqual(value, { a: "fine", b: { c: "" }, d: [""] });
  assert.equal(stripped.length, 2);
});

test("parses Vaani and case-pack transcripts, drops annotations", () => {
  const vaani = parseTranscript("[13:33:14] AGENT: Hi, Aangan Studio.\n[13:33:20] USER: I have a 2BHK in Baner.");
  assert.deepEqual(vaani.map((t) => t.role), ["agent", "caller"]);
  const pack = parseTranscript("# T14 · Phone\n\nFront Desk: Hello.\nCaller: For my parents.\nNote: Caller is son.");
  assert.equal(pack.length, 2);
  assert.equal(pack[1].text, "For my parents.");
});
