export type Turn = { role: "agent" | "caller"; text: string };

const AGENT = /^(agent|bot|assistant|front ?desk|reception(ist)?)$/i;
const CALLER = /^(user|caller|customer|client|human)$/i;
// "[13:33:14] AGENT: text" (Vaani) or "Front Desk: text" (case pack)
const LINE = /^\s*(?:\[[^\]]*\]\s*)?([A-Za-z][A-Za-z ]{0,20}?)\s*:\s*(.*)$/;

/**
 * Parses a transcript string into turns. Lines without a speaker label continue the
 * previous turn. Case-pack annotations ("Note: …") and headings are dropped, because a
 * real call never carries a human's after-the-fact note.
 */
export function parseTranscript(raw: string): Turn[] {
  const turns: Turn[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(LINE);
    const who = m?.[1].trim() ?? "";
    if (m && AGENT.test(who)) turns.push({ role: "agent", text: m[2].trim() });
    else if (m && CALLER.test(who)) turns.push({ role: "caller", text: m[2].trim() });
    else if (m && /^(note|status)$/i.test(who)) continue;
    else if (turns.length) turns[turns.length - 1].text += " " + t;
    else turns.push({ role: "caller", text: t });
  }
  return turns.filter((x) => x.text);
}

/** Accepts Vaani's string transcript or an array of {role|speaker, text|content}. */
export function toTurns(input: unknown): Turn[] {
  if (typeof input === "string") return parseTranscript(input);
  if (!Array.isArray(input)) return [];
  return input
    .map((x: any) => {
      const who = String(x?.role ?? x?.speaker ?? "");
      const text = String(x?.text ?? x?.content ?? x?.message ?? "").trim();
      return { role: AGENT.test(who) ? "agent" : "caller", text } as Turn;
    })
    .filter((x) => x.text);
}

export function formatTurns(turns: Turn[]): string {
  return turns.map((t) => `${t.role === "agent" ? "AGENT" : "CALLER"}: ${t.text}`).join("\n");
}

export function callerText(turns: Turn[]): string {
  return turns.filter((t) => t.role === "caller").map((t) => t.text).join("\n");
}
