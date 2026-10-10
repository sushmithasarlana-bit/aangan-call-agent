#!/usr/bin/env node
// Runs the September case-pack calls through /api/eval (dry run: no DB row, email or CRM)
// and writes a results table to evals/results.md.
//
//   node scripts/eval.mjs --base https://<your-app>.vercel.app          all 10 cases
//   node scripts/eval.mjs --base http://localhost:3000 --only T07,T10    a subset
//
// The free Gemini tier allows ~20 requests a day, so each case is one request, spaced out.
import fs from "node:fs";
import path from "node:path";
import { stripPrices } from "../lib/price-guard.ts";
import { parseTranscript, callerText } from "../lib/transcript.ts";

const root = path.resolve(import.meta.dirname, "..");
if (fs.existsSync(path.join(root, ".env.local"))) process.loadEnvFile(path.join(root, ".env.local"));

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const base = (arg("base") ?? process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const only = arg("only")?.split(",").map((s) => s.trim().toUpperCase());
const token = process.env.VAANI_WEBHOOK_SECRET;
if (!token) throw new Error("VAANI_WEBHOOK_SECRET missing (expected in .env.local)");

const cases = JSON.parse(fs.readFileSync(path.join(root, "evals/cases.json"), "utf8")).filter((c) => !only || only.includes(c.id));
const rows = [];

for (const [i, c] of cases.entries()) {
  if (i > 0) await new Promise((r) => setTimeout(r, 7000));
  const transcript = fs.readFileSync(path.join(root, `evals/transcripts/${c.id}_phone.md`), "utf8");
  process.stdout.write(`${c.id} … `);
  const res = await fetch(`${base}/api/eval?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: c.id, transcript, call_time: c.call_time }),
  });
  const r = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (r.error) {
    console.log(`ERROR ${r.error}`);
    rows.push({ ...c, error: r.error, pass: false });
    continue;
  }
  // Independent check of the Cut: does any output text still carry a price the caller didn't say?
  const said = callerText(parseTranscript(transcript));
  const allText = [r.fit_reason, r.handoff_note, ...Object.values(r.lead ?? {}).map(String), ...(r.uncertainties ?? [])].join("\n");
  const leaked = stripPrices(allText, said).stripped;

  const checks = [r.classification === c.expect];
  if (c.criterion) checks.push(r.failed_criterion === c.criterion);
  if (c.asked_pricing !== undefined) checks.push(r.asked_pricing === c.asked_pricing);
  checks.push(leaked.length === 0);
  const pass = checks.every(Boolean);
  rows.push({ ...c, got: r.classification, got_criterion: r.failed_criterion, asked: r.asked_pricing, reason: r.fit_reason, note: r.handoff_note, uncertainties: r.uncertainties, stripped: r.price_lines_stripped?.length ?? 0, leaked, model: r.model, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${r.classification} (${r.failed_criterion})`);
}

const passed = rows.filter((r) => r.pass).length;
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const md = [
  `# Eval: September 2026 phone enquiries`,
  ``,
  `Run ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC against \`${base}\` · model \`${rows.find((r) => r.model)?.model ?? "?"}\` · **${passed}/${rows.length} correct** · price figures in output: **${rows.reduce((n, r) => n + (r.leaked?.length ?? 0), 0)}**`,
  ``,
  `A case passes when the classification matches, the deciding criterion matches (for not_fit), \`asked_pricing\` matches where expected, and no output line carries a price the caller didn't say. Transcripts are the case-pack originals with the human "Note:" annotations removed.`,
  ``,
  `| Call | Scenario | Expected | Got | Deciding criterion | Asked price | Reason given | Result |`,
  `|---|---|---|---|---|---|---|---|`,
  ...rows.map((r) =>
    `| ${r.id} | ${esc(r.why)} | ${r.expect}${r.criterion ? ` (${r.criterion})` : ""}${r.asked_pricing ? ", asked_pricing" : ""} | ${r.error ? "error" : r.got} | ${esc(r.got_criterion)} | ${r.asked ? "yes" : "no"} | ${esc(r.error ?? r.reason)} | ${r.pass ? "✅" : "❌"} |`),
  ``,
  `## Handoff notes`,
  ``,
  ...rows.filter((r) => r.note).flatMap((r) => [`**${r.id}** (${r.got})`, "", "```", r.note, "```", ""]),
].join("\n");

fs.writeFileSync(path.join(root, only ? "evals/results-partial.md" : "evals/results.md"), md);
fs.writeFileSync(path.join(root, only ? "evals/results-partial.json" : "evals/results.json"), JSON.stringify(rows, null, 2));
console.log(`\n${passed}/${rows.length} correct. Wrote evals/${only ? "results-partial" : "results"}.md`);
