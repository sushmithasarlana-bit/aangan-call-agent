#!/usr/bin/env node
// Simulates one Vaani call (call_started, then call_postprocessing) against the webhook,
// so you can test the whole pipeline without spending Vaani minutes.
// This is NOT a dry run: it writes a database row, sends the designer email and creates a HubSpot deal.
//
//   node scripts/send-test-webhook.mjs --base https://<your-app>.vercel.app
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
if (fs.existsSync(path.join(root, ".env.local"))) process.loadEnvFile(path.join(root, ".env.local"));
const i = process.argv.indexOf("--base");
const base = (i > -1 ? process.argv[i + 1] : process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const url = `${base}/api/vaani/webhook?token=${encodeURIComponent(process.env.VAANI_WEBHOOK_SECRET ?? "")}`;

const room = `test-${Date.now()}`;
const start = new Date(Date.now() - 4 * 60 * 1000);
const end = new Date();
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const t = (s) => new Date(start.getTime() + s * 1000).toISOString().slice(11, 19);

const transcript = [
  `[${t(0)}] AGENT: Hi, thanks for calling Aangan Studio. This call is recorded so our designers have your details. How can I help you today?`,
  `[${t(6)}] USER: Hi, I'm Test Caller. We just got possession of a 3BHK in Baner, about 1,350 square feet, and want full interiors.`,
  `[${t(18)}] AGENT: Congratulations! When would you like the project complete?`,
  `[${t(24)}] USER: By March would be great. What's your per square foot rate, roughly?`,
  `[${t(31)}] AGENT: Your designer will walk you through pricing on the consultation, because it depends on your site and choices. Are you the decision-maker?`,
  `[${t(40)}] USER: Yes, me and my wife. I found you on Instagram.`,
  `[${t(46)}] AGENT: Lovely. I can offer tomorrow at 11am or 4pm for a consultation.`,
  `[${t(52)}] USER: 4pm tomorrow works.`,
  `[${t(55)}] AGENT: Booked for tomorrow at 4pm. Thank you!`,
].join("\n");

const post = async (body) => {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  console.log(body.event, res.status, await res.text());
};

await post({ event: "call_started", room_name: room, phone_number: "+919800000000", timestamp: start.toISOString() });
await post({
  event: "call_postprocessing",
  room_name: room,
  phone_number: "+919800000000",
  timestamp: end.toISOString(),
  transcript,
  summary: "TEST CALL. Caller wants full interiors for a new 3BHK in Baner and asked about the per sq ft rate.",
  entities: { name: "Test Caller", area: "Baner", booked_slot: `${tomorrow}T16:00:00+05:30` },
  recording_url: null,
});
