import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findingsOf, matches, stillReported, atLeast } from "../../lib/findings.mjs";
const truth = JSON.parse(readFileSync(join(import.meta.dirname, "truth.json"), "utf8"));
export default async function acceptance({ state }) {
  const findings = findingsOf(state);
  const missing = truth.filter(t => !findings.some(f => matches(f, t, 1) && stillReported(f) && t.terms.every(term => new RegExp(term, "i").test(f.claim + " " + f.evidence))));
  const noise = findings.filter(f => f.location.path === "src/suffix.py" && atLeast(f, "major") && stillReported(f));
  return [
    { id: "seeded-defects-found", pass: missing.length === 0, detail: missing.length ? "missing or unsupported finding: " + missing.map(t => t.id).join(", ") : "all seeded defects reported with matching evidence" },
    { id: "no-false-alarm", pass: noise.length === 0, detail: noise.length ? "major finding on correct control source" : "correct source not falsely reported" },
  ];
}
