import { env, numEnv } from "./env";
import { knowledge } from "./knowledge";
import { callerText, formatTurns, type Turn } from "./transcript";
import { guardDeep } from "./price-guard";
import { fmtIST } from "./hours";

export const CLASSES = ["qualified", "not_fit", "complaint", "unclear"] as const;
export type Classification = (typeof CLASSES)[number];

export type Lead = {
  name: string | null;
  phone: string | null;
  area: string | null;
  property_type: string | null;
  size_sqft: number | null;
  scope: string | null;
  timeline: string | null;
  decision_maker: string | null;
  budget_volunteered: string | null;
  referral_source: string | null;
  rented: boolean | null;
};

export type Result = {
  classification: Classification;
  failed_criterion: string;
  fit_reason: string;
  asked_pricing: boolean;
  segment: "home" | "office" | "unknown";
  lead: Lead;
  uncertainties: string[];
  handoff_note: string;
  booked_slot_iso: string | null;
};

export type ClassifyOutput = {
  result: Result;
  model: string;
  costInr: number;
  priceLinesStripped: string[];
};

function systemPrompt(): string {
  const k = knowledge();
  return `You classify phone enquiries for Aangan Studio, an interior design studio in Pune. The founder's rubric and the services list below are the only rules. Apply them; do not invent new ones.

<qualified.md>
${k["qualified.md"]}
</qualified.md>

<services.md>
${k["services.md"]}
</services.md>

Pick exactly one classification:
- qualified: passes all five criteria. Being unclear on budget (4) or decision-maker (5) still counts as qualified; record the uncertainty. A rented flat with no structural changes is fine. A single room with full execution is fine. Asking about price never disqualifies anyone.
- not_fit: fails any one criterion, or is outside services.md. That means outside Pune city/PCMC; advice, ideas or decor only; restaurants, hotels, retail, gyms; structural work; standalone furniture or Vastu-only; work that must be finished in under 6 weeks from the call date; or a volunteered budget clearly too low for the scope described (for example ₹1–1.5 lakh for a full flat, or for a kitchen plus a bedroom with execution).
- complaint: an existing client with a problem on their project, or a caller angry about work the studio is doing for them. A human handles it, whatever else was said.
- unclear: the call dropped, or there is too little information to judge criteria 1–3.

Judgement notes:
- Service area: the locality list in services.md is not exhaustive. Any locality inside Pune city or PCMC counts (for example Kharadi, Bavdhan, Nanded City). Only places outside Pune and PCMC fail (Talegaon, Lonavala, Nashik, Mumbai, other cities). If the location is vague (for example just "Phase 1", with no area named), don't guess: add it to uncertainties and say in watch-outs that the designer must confirm the locality.
- Timeline: compare the caller's required finish date with the call date given below. Fail only if they need it finished in under 6 weeks. Far-off dates are fine. If the caller only muses about a later start without committing to it, judge the request they actually made.
- Decision-maker: someone calling for parents or a spouse is represented if those people will attend the consultation or have authorised the caller. Qualify, and note it.
- Budget: never infer a budget from the property type or locality. Only judge a figure the caller volunteered.
- A new enquirer who is frustrated because the studio did not call back is a lead, not a complaint. Classify on the project and flag the frustration in the note.

Fields:
- fit_reason: one sentence naming the deciding criterion, e.g. "Fails criterion 2 (service area): the property is in Nashik." or "Passes all five; decision-makers are the caller's parents, who will attend."
- failed_criterion: the criterion that decided a not_fit, otherwise "none" (or "complaint" / "insufficient_info").
- asked_pricing: true if the caller asked about price, cost, rates, a ballpark or a range at any point.
- segment: home or office.
- handoff_note: exactly 8 short lines for a designer reading on a phone, one per item:
  1. Who: name, phone if given, how they heard of Aangan
  2. Property: type, size, locality
  3. Scope: what they want done
  4. Timeline: possession, start, finish
  5. Decision-maker
  6. Budget: "Not discussed" or "Caller volunteered: <their words>"
  7. Pricing: whether they asked, and that it is for the designer at the consultation
  8. Watch-outs and next step (for not_fit or unclear: why it was closed or what's missing)
- booked_slot_iso: if a consultation slot was agreed on the call, its start in ISO 8601 with a +05:30 offset, resolving relative days against the call time. Otherwise null.

PRICING RULE (never broken): do not write any price, rate, per-sq-ft figure, range, cost or estimate anywhere in your output. The only money figure you may repeat is a budget the caller volunteered, in their own words.`;
}

const S = (description?: string) => ({ type: "STRING", ...(description ? { description } : {}) });
const NS = { type: "STRING", nullable: true };

const SCHEMA = {
  type: "OBJECT",
  properties: {
    lead: {
      type: "OBJECT",
      properties: {
        name: NS, phone: NS, area: NS, property_type: NS,
        size_sqft: { type: "NUMBER", nullable: true },
        scope: NS, timeline: NS, decision_maker: NS, budget_volunteered: NS, referral_source: NS,
        rented: { type: "BOOLEAN", nullable: true },
      },
      required: ["name", "phone", "area", "property_type", "size_sqft", "scope", "timeline", "decision_maker", "budget_volunteered", "referral_source", "rented"],
    },
    asked_pricing: { type: "BOOLEAN" },
    fit_reason: S(),
    failed_criterion: {
      type: "STRING",
      enum: ["none", "real_project", "service_area", "timeline", "budget", "decision_maker", "out_of_scope", "complaint", "insufficient_info"],
    },
    classification: { type: "STRING", enum: [...CLASSES] },
    segment: { type: "STRING", enum: ["home", "office", "unknown"] },
    uncertainties: { type: "ARRAY", items: S() },
    handoff_note: S(),
    booked_slot_iso: NS,
  },
  required: ["lead", "asked_pricing", "fit_reason", "failed_criterion", "classification", "segment", "uncertainties", "handoff_note", "booked_slot_iso"],
  propertyOrdering: ["lead", "asked_pricing", "fit_reason", "failed_criterion", "classification", "segment", "uncertainties", "handoff_note", "booked_slot_iso"],
};

export type ClassifyInput = {
  turns: Turn[];
  callTime: Date;
  callerNumber?: string | null;
  summary?: string | null;
  entities?: Record<string, unknown>;
};

export async function classify(input: ClassifyInput): Promise<ClassifyOutput> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const context = [
    `Call time (IST): ${fmtIST(input.callTime, { year: "numeric" })}`,
    input.callerNumber ? `Caller number: ${input.callerNumber}` : null,
    input.summary ? `Voice agent summary: ${input.summary}` : null,
    input.entities && Object.keys(input.entities).length ? `Voice agent extracted fields: ${JSON.stringify(input.entities)}` : null,
    "",
    "Transcript:",
    formatTurns(input.turns),
  ].filter((x) => x !== null).join("\n");

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt() }] },
    contents: [{ role: "user", parts: [{ text: context }] }],
    generationConfig: { temperature: 0.1, responseMimeType: "application/json", responseSchema: SCHEMA },
  };

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": env("GEMINI_API_KEY") },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(40_000),
      });
      if (!res.ok) {
        const msg = `Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`;
        // 4xx (bad key, quota, closed model) won't fix itself on retry.
        if (res.status < 500) throw Object.assign(new Error(msg), { final: true });
        throw new Error(msg);
      }
      const json: any = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
      const parsed = validate(JSON.parse(text));
      const usage = json?.usageMetadata ?? {};
      const costInr =
        ((usage.promptTokenCount ?? 0) * numEnv("GEMINI_INR_PER_M_INPUT", 0) +
          ((usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0)) * numEnv("GEMINI_INR_PER_M_OUTPUT", 0)) /
        1e6;

      // The Cut, in code: strip any price line the model wrote despite the prompt.
      const guarded = guardDeep(parsed, callerText(input.turns));
      return { result: guarded.value, model, costInr, priceLinesStripped: guarded.stripped };
    } catch (e: any) {
      lastErr = e;
      if (e?.final) break;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function validate(r: any): Result {
  if (!r || !CLASSES.includes(r.classification)) throw new Error(`Bad classification: ${JSON.stringify(r)?.slice(0, 200)}`);
  return {
    classification: r.classification,
    failed_criterion: String(r.failed_criterion ?? "none"),
    fit_reason: String(r.fit_reason ?? ""),
    asked_pricing: Boolean(r.asked_pricing),
    segment: ["home", "office"].includes(r.segment) ? r.segment : "unknown",
    lead: { ...r.lead, size_sqft: Number(r.lead?.size_sqft) || null },
    uncertainties: Array.isArray(r.uncertainties) ? r.uncertainties.map(String) : [],
    handoff_note: String(r.handoff_note ?? ""),
    booked_slot_iso: r.booked_slot_iso && !isNaN(Date.parse(r.booked_slot_iso)) ? r.booked_slot_iso : null,
  };
}
