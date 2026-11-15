// Temporary (NFR-01 work): paired warm/cold latency of two bundles on one runner, arms alternated per repeat.
//   node tools/bench-pair.ts <baseline.mjs> <candidate.mjs> [repeats]
// Prints one JSON line per attempt and a summary of warm p95 per fixture and arm. Removed when the work ends.
import { mkdtempSync, rmSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join } from "node:path";
import { measureFixture, percentile } from "./bench.ts";
import { FIXTURES } from "./bench-fixtures.ts";
import type { FixtureName } from "./bench-fixtures.ts";

const [baseline, candidate] = [process.argv[2]!, process.argv[3]!];
const repeats = Number(process.argv[4] ?? 4);
const arms = { baseline, candidate } as const;
type Arm = keyof typeof arms;
const p95 = (xs: number[]) => percentile(xs, 95);
const median = (xs: number[]) => percentile(xs, 50);
const results: Array<{ fixture: FixtureName; arm: Arm; repeat: number; warmP95: number; warmP50: number; coldP95: number; bad: number;
  byLabel: Record<string, number> }> = [];

console.log(`cpu: ${cpus()[0]?.model} x${cpus().length}`);
for (let r = 0; r < repeats; r++) {
  for (const fixture of Object.keys(FIXTURES) as FixtureName[]) {
    const order: Arm[] = r % 2 ? ["candidate", "baseline"] : ["baseline", "candidate"];
    for (const arm of order) {
      const scratch = mkdtempSync(join(tmpdir(), "tenet-pair-"));
      try {
        const m = measureFixture(arms[arm], fixture, FIXTURES[fixture], scratch);
        const byLabel: Record<string, number> = {};
        for (const label of new Set(m.warm.map((c) => c.label))) byLabel[label] = Math.round(median(m.warm.filter((c) => c.label === label).map((c) => c.ms)));
        const row = { fixture, arm, repeat: r + 1, warmP95: Math.round(p95(m.warm.map((c) => c.ms))), warmP50: Math.round(median(m.warm.map((c) => c.ms))),
          coldP95: Math.round(p95(m.cold.map((c) => c.ms))), bad: [...m.warm, ...m.cold].filter((c) => c.exit !== 0).length, byLabel };
        results.push(row);
        console.log(JSON.stringify(row));
      } finally { rmSync(scratch, { recursive: true, force: true }); }
    }
  }
}
console.log("\nfixture       arm        warm p95 per repeat           median p95  median p50  cold p95");
for (const fixture of Object.keys(FIXTURES) as FixtureName[]) {
  const med: Record<string, number> = {};
  for (const arm of ["baseline", "candidate"] as Arm[]) {
    const rows = results.filter((x) => x.fixture === fixture && x.arm === arm);
    med[arm] = median(rows.map((x) => x.warmP95));
    console.log(`${fixture.padEnd(13)} ${arm.padEnd(10)} ${rows.map((x) => String(x.warmP95).padStart(4)).join(" ").padEnd(30)} ${String(med[arm]).padStart(10)}`
      + ` ${String(median(rows.map((x) => x.warmP50))).padStart(11)} ${String(median(rows.map((x) => x.coldP95))).padStart(9)}`);
  }
  const diffs = Array.from({ length: repeats }, (_, i) => {
    const pick = (arm: Arm) => results.find((x) => x.fixture === fixture && x.arm === arm && x.repeat === i + 1)!.warmP95;
    return pick("candidate") - pick("baseline");
  });
  console.log(`${fixture.padEnd(13)} paired diff (candidate - baseline) per repeat: ${diffs.join(", ")}; median ${median(diffs)}`);
}
if (results.some((x) => x.bad)) { console.log("some calls exited non-zero"); process.exitCode = 1; }
