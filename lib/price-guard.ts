/**
 * The Cut, enforced in code. The prompt already forbids prices, but a prompt is a request,
 * not a guarantee. Every line of AI output passes through here before it is stored, emailed
 * or sent to the CRM. A line is removed if it carries a money figure or a rate, unless every
 * figure in it is one the caller said themselves (their own volunteered budget is allowed).
 */

// ₹ 4,00,000 | Rs. 5 lakh | INR 2 crore | 1.5 lakh | 2-3 L | 18k | 2,400 per sq ft
const MONEY =
  /(?:₹|\brs\.?|\binr)\s*\d[\d,]*(?:\.\d+)?(?:\s*(?:[-–—]|to)\s*\d[\d,]*(?:\.\d+)?)?(?:\s*(?:lakhs?|lacs?|crores?|cr|k|l)\b)?|\d[\d,]*(?:\.\d+)?(?:\s*(?:[-–—]|to)\s*\d[\d,]*(?:\.\d+)?)?\s*(?:lakhs?|lacs?|crores?|cr\b|k\b|l\b)/gi;
const RATE = /\d[\d,]*(?:\.\d+)?\s*(?:[-–—]|to)?\s*\d*[\d,]*\s*(?:\/|per)\s*(?:sq\.?\s*(?:ft|feet|foot)|square\s*(?:ft|feet|foot)|sqft|psf)/i;

const figures = (s: string): string[] =>
  [...s.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0].replace(/,/g, ""));

/** Numbers the caller attached to money ("my budget is 1 to 1.5 lakh"). */
export function callerMoneyFigures(callerText: string): Set<string> {
  const out = new Set<string>();
  for (const m of callerText.matchAll(MONEY)) for (const f of figures(m[0])) out.add(f);
  return out;
}

export type GuardResult = { text: string; stripped: string[] };

export function stripPrices(text: string, callerText: string): GuardResult {
  const allowed = callerMoneyFigures(callerText);
  const stripped: string[] = [];
  const kept = text.split("\n").filter((line) => {
    const money = [...line.matchAll(MONEY)].flatMap((m) => figures(m[0]));
    const isRate = RATE.test(line);
    const ok = !isRate && money.every((f) => allowed.has(f));
    if (!ok) stripped.push(line);
    return ok;
  });
  return { text: kept.join("\n"), stripped };
}

/** Applies stripPrices to every string inside a JSON-like value. */
export function guardDeep<T>(value: T, callerText: string, stripped: string[] = []): { value: T; stripped: string[] } {
  const walk = (v: any): any => {
    if (typeof v === "string") {
      const r = stripPrices(v, callerText);
      stripped.push(...r.stripped);
      return r.text;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return { value: walk(value), stripped };
}
