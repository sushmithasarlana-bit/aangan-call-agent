# Aangan call agent

An AI front desk for **Aangan Studio**, an interior design studio in Pune (MESA Case 03). It answers every phone enquiry, day or night. It qualifies each caller against the founder's rubric, books a consultation during the call, and emails the designer a one-screen brief. A dashboard shows results and running cost.

**It never quotes a price.** That's the Cut.

- **Live app:** https://aangan-call-agent-pi.vercel.app (dashboard username `aangan`; the password is shared separately)
- **Component map:** [`docs/component-map.html`](docs/component-map.html)
- **Eval:** [`evals/results.md`](evals/results.md), the 10 September enquiries scored against the expected answers

---

## The brief

Nikhil (founder) loses about half his enquiries: 48% of roughly 200 a month get no reply within 48 hours, and a third arrive outside 10am–7pm. A reply within an hour converts about 4× better. He asked for:

1. Every phone enquiry answered within 5 minutes, day or night.
2. Qualified leads reaching a designer with full context.
3. A dashboard with results and running cost.
4. Handoff to designers by email.

He also asked for the agent to quote standard per-sq-ft pricing. **That is the Cut.** A price spoken in the studio's voice is heard as a commitment, and it can't be taken back. The agent says: *"Your designer will walk you through pricing on the consultation, because it depends on your site and choices."*

## How it works

```
Caller ─► Vaani AI voice agent: answers, asks the qualifying questions, books a slot
              │  webhooks: call_started + call_postprocessing  (?token=secret)
              ▼
        /api/vaani/webhook (Next.js on Vercel)
              │  1. log the call in Neon Postgres (number, times, transcript, cost)
              │  2. idempotency latch, so a retried webhook never double-emails
              ▼
        Gemini Flash classifies against qualified.md + services.md (JSON mode)
              │  3. price guard: strips any price line from AI output (the caller's own budget is allowed)
              │
   qualified ─┼─► designer email (Resend) with Claim / Reschedule / Booking link, plus a HubSpot deal
   complaint ─┼─► front-desk email: a human calls back first thing
   not a fit / unclear ─► logged on the dashboard only
   AI failed ─┴─► front-desk email with the raw transcript, so no lead is ever lost
              ▼
        Dashboard (/): calls, after-hours share, qualified, booked, show-ups, won, ₹ cost
```

## The Nine Checks

| | Check | Answer |
|---|---|---|
| ⚡ 01 | Is the problem real? | **Yes.** ~48% of ~200 monthly enquiries get no reply within 48 h; a third arrive after hours. |
| ⚡ 02 | Is the workflow repeated? | **Yes.** ~200 calls a month; the first four steps are identical every time. |
| ⚡ 03 | Is the input available? | **Yes, partly.** `services.md` and `qualified.md` are enough to answer and qualify. `pricing.md` exists but is never used for output. |
| 📊 04 | Is the output valuable? | **Yes.** A consultation booked during the call, on a ₹8–14 lakh project. |
| 📊 05 | Is the impact measurable? | **Yes.** Time to first response, consultations booked and show-up rate, all on the dashboard from day one. |
| 📊 08 | Is the ROI worth it? | **Yes.** ~96 unanswered calls a month; one extra project covers the tool cost many times over. |
| 🚧 06 | Is the failure risk OK? | **Yes** for answering, qualifying and booking. **No for pricing**, so pricing stays human. |
| 🚧 07 | Is judgment protected? | **Partly.** Quoting, committing to site visits or dates, and complaints stay with people. |
| 🚧 09 | Is the owner clear? | **Yes.** The agent qualifies and books, the designer owns the relationship, and Nikhil owns the price. |

## How the Cut is enforced (three layers)

1. **The voice prompt** forbids any price, rate, range or estimate and gives one deflection line ([`vaani/agent-setup.md`](vaani/agent-setup.md)).
2. **`pricing.md` is never loaded.** [`lib/knowledge.ts`](lib/knowledge.ts) reads two named files only. `pricing.md` is git-ignored, Vercel-ignored and excluded from the server bundle ([`next.config.ts`](next.config.ts)).
3. **A code-level price guard** ([`lib/price-guard.ts`](lib/price-guard.ts)) runs on every AI output before it is stored, emailed or sent to HubSpot. It removes any line with a money figure or a per-sq-ft rate unless every figure in it is one the caller said themselves. Unit tests: [`tests/price-guard.test.ts`](tests/price-guard.test.ts).

Asking about price never disqualifies a caller. It sets `asked_pricing`, and the designer email says the client expects pricing at the consultation.

## Classification rules

From `qualified.md` and `services.md`, verbatim in the prompt ([`lib/classify.ts`](lib/classify.ts)):

- **qualified:** passes all five criteria (real project with execution; Pune/PCMC; can be done in time; volunteered budget not clearly too low; decision-maker on the call or represented). Unclear budget or decision-maker still counts as qualified, with a note. Rented flats with no structural work and single rooms with execution are fine.
- **not_fit:** outside Pune/PCMC, advice or decor only, restaurants/hotels/retail/gyms, structural work, under 6 weeks of lead time, or a volunteered budget clearly too low.
- **complaint:** an existing client with a problem, or an angry caller. A human handles it.
- **unclear:** a dropped call or almost no information.

Each result names the deciding criterion and carries an 8-line handoff note written for a designer reading on a phone.

## Stack (free tiers)

| Piece | Used for |
|---|---|
| [Vaani AI](https://app.vaanivoice.ai) | Voice agent, webhooks |
| Gemini Flash (REST `generateContent`, JSON mode) | Classification |
| [Neon](https://neon.com) Postgres (Singapore, nearest to Pune) | `calls`, `designers`, `daily_metrics` view |
| Next.js 16 App Router on Vercel | Webhook, eval route, signed email links, dashboard |
| Resend | Designer and front-desk email |
| HubSpot (optional) | One deal per qualified lead |
| Cal.com / Calendly (optional) | Fallback booking link in the email |

## Repo layout

```
app/api/vaani/webhook/   Vaani posts every call here
app/api/eval/            Dry-run classifier for past transcripts (no DB, email or CRM)
app/api/lead/[action]/   Claim / Reschedule: GET shows a confirm page, POST records it
app/page.tsx             Nikhil's dashboard (basic auth via proxy.ts)
lib/                     pipeline, classify (Gemini), price-guard, vaani, email, hubspot, links, db
knowledge/               qualified.md + services.md (pricing.md is never committed)
evals/                   cases.json (expected answers), transcripts/, results.md
db/schema.sql            Neon schema
vaani/agent-setup.md     Voice agent prompt, greeting, webhook settings
```

## Run it yourself

1. **Database:** create a Neon project and run [`db/schema.sql`](db/schema.sql). Insert one designer, using your Resend signup email while you're on Resend's sandbox sender.
2. **Env vars:** copy [`.env.example`](.env.example). On Vercel, add them under Settings → Environment Variables (paste keys there, never into a chat), then redeploy.
3. **Vaani:** follow [`vaani/agent-setup.md`](vaani/agent-setup.md). Webhook URL: `https://<app>/api/vaani/webhook?token=<VAANI_WEBHOOK_SECRET>`, events *Call Started* and *Call Post-Processing*.
4. **Test without spending minutes:**
   ```bash
   npm test                                              # price guard + transcript parser
   node scripts/eval.mjs --base https://<app>            # 10 September calls through /api/eval
   node scripts/send-test-webhook.mjs --base https://<app>   # one simulated call, end to end (sends a real email)
   ```

## Engineering notes

- **Unsigned webhooks:** Vaani AI doesn't sign its webhooks, so the secret is in the URL and compared in constant time.
- **Idempotent:** `call_started` only fills blanks. `call_postprocessing` takes a one-time `processed_at` latch, so a retry never overwrites the call or sends a second email.
- **Duration:** real Vaani payloads send `call_duration` in seconds (the class guide said milliseconds; anything above 10,000 is treated as milliseconds). When it is missing, duration comes from `call_started_at` → `call_ended_at`.
- **Never lose a lead:** if Gemini fails, the raw transcript goes to the front desk. Each output (email, HubSpot) is best-effort and logged in `output_errors`.
- **Link scanners:** email clients pre-open links, so Claim / Reschedule are HMAC-signed. GET only shows a confirm page; POST records the action. A claim is atomic: first to claim wins.
- **Free-tier limits:** Gemini's free tier allows about 20 requests a day, so the eval spaces its requests out. Resend's sandbox only delivers to your own address. Inbound phone numbers on Vaani are paid, so demos use Vaani's test call.

## Out of scope (next)

WhatsApp and the web form reuse everything except the trigger: post the message thread to the same classifier and pipeline.
