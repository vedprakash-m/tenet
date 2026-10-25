import { readFileSync } from "node:fs";
import { join } from "node:path";
import { atLeast, findingsOf, missed } from "../../lib/findings.mjs";

const truth = JSON.parse(readFileSync(join(import.meta.dirname, "truth.json"), "utf8"));

export default async function acceptance({ state }) {
  const findings = findingsOf(state);
  const gone = missed(findings, truth);
  const noise = findings.filter((f) => f.location.path === "src/format.mjs" && atLeast(f, "major"));
  return [
    { id: "seeded-defects-found", pass: gone.length === 0, detail: gone.length ? `not reported: ${gone.map((t) => t.id).join(", ")}` : `all ${truth.length} seeded defects reported with file, line and severity` },
    { id: "no-false-alarm-on-correct-code", pass: noise.length === 0, detail: noise.length ? "a major finding on src/format.mjs, which is correct" : "no major finding on the correct module" },
  ];
}
