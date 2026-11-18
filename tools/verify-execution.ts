import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadInventory, selectedFiles } from "./test-runner.ts";

interface ReportLeaf { id: string; key: string; file: string; status: "pass" | "fail" | "skip" }
interface Report { terminal: { success: boolean }; leaves: ReportLeaf[]; files: Array<{ file: string }>;
  identity: { schemaVersion: number; lane: string; inventorySha256: string; shard: string | null; node: string; sourceFiles: string[] } }
interface Baseline { version: number; lanes: Record<string, Array<{ key: string; count: number }>> }

const argument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};
const duplicate = <T,>(values: T[]): T[] => [...new Set(values.filter((item, index) => values.indexOf(item) !== index))];

export function verifyReports(root: string, lane: string, reportPaths: string[], complete = true): ReportLeaf[] {
  if (!reportPaths.length) throw new Error("execution verification requires at least one report");
  const { inventory, digest } = loadInventory(root);
  const laneDefinition = inventory.lanes[lane];
  if (!laneDefinition) throw new Error(`unknown lane: ${lane}`);
  const reports = reportPaths.map((path) => JSON.parse(readFileSync(resolve(root, path), "utf8")) as Report);
  for (const report of reports) {
    if (report.identity?.schemaVersion !== 1 || report.identity.lane !== lane || report.identity.inventorySha256 !== digest)
      throw new Error(`execution report identity mismatch for lane ${lane}`);
    if (!report.terminal?.success) throw new Error(`execution report failed for lane ${lane}`);
    const completedFiles = report.files.map((file) => file.file).sort();
    if (completedFiles.join("\n") !== [...report.identity.sourceFiles].sort().join("\n"))
      throw new Error(`execution report files disagree with source identity for lane ${lane}`);
  }
  const expected = selectedFiles(root, lane);
  const reportedFiles = reports.flatMap((report) => report.identity.sourceFiles);
  const repeatedFiles = duplicate(reportedFiles);
  if (repeatedFiles.length) throw new Error(`execution files overlap across shards: ${repeatedFiles.join(", ")}`);
  if (complete && [...reportedFiles].sort().join("\n") !== expected.sort().join("\n"))
    throw new Error(`execution file union differs from lane ${lane}`);
  for (const report of reports) {
    if (!complete && report.identity.shard === null) throw new Error(`partial execution check requires a shard report for lane ${lane}`);
  }
  const leaves = reports.flatMap((report) => report.leaves);
  const sourceFiles = new Set(reportedFiles);
  const outside = leaves.filter((leaf) => !sourceFiles.has(leaf.file));
  if (outside.length) throw new Error(`execution leaves came from unexpected files in lane ${lane}`);
  const duplicates = duplicate(leaves.map((leaf) => leaf.id));
  if (duplicates.length) throw new Error(`execution leaves overlap across shards: ${duplicates.join(", ")}`);
  const allowedSkips = new Set(laneDefinition.allowedSkips ?? []);
  const failed = leaves.filter((leaf) => leaf.status !== "pass" &&
    !(leaf.status === "skip" && allowedSkips.has(`${leaf.file} :: ${leaf.key}`)));
  if (failed.length) throw new Error(`non-passing required leaves in lane ${lane}: ${failed.map((leaf) => `${leaf.file} :: ${leaf.key} [${leaf.status}]`).join("; ")}`);
  const actualLeaves = new Set(leaves.map((leaf) => `${leaf.file} :: ${leaf.key}`));
  const missingLeaves = (laneDefinition.requiredLeaves ?? []).filter((leaf) => !actualLeaves.has(leaf));
  if (complete && missingLeaves.length) throw new Error(`required leaves missing from lane ${lane}: ${missingLeaves.join("; ")}`);
  if (complete) {
    const baseline = JSON.parse(readFileSync(resolve(root, "tools/test-baseline.json"), "utf8")) as Baseline;
    if (baseline.version !== 1) throw new Error("test baseline version is not supported");
    const expectedBaseline = baseline.lanes[lane];
    if (!expectedBaseline && !(laneDefinition.requiredLeaves?.length)) throw new Error(`test baseline missing lane ${lane}`);
    const counts = new Map<string, number>();
    for (const leaf of leaves) {
      const key = `${leaf.file} :: ${leaf.key}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const missing = (expectedBaseline ?? []).filter((entry) => (counts.get(entry.key) ?? 0) < entry.count);
    if (missing.length) throw new Error(`reviewed leaf baseline missing from lane ${lane}: ${missing.map((entry) => entry.key).join("; ")}`);
  }
  const filesWithoutLeaves = reportedFiles.filter((file) => !leaves.some((leaf) => leaf.file === file));
  if (filesWithoutLeaves.length) throw new Error(`test files emitted no leaves in lane ${lane}: ${filesWithoutLeaves.join(", ")}`);
  return leaves;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const root = resolve(import.meta.dirname, "..");
  const lane = argument("--lane");
  const paths = argument("--reports")?.split(",").filter(Boolean) ?? [];
  const output = argument("--output");
  if (!lane || !paths.length || !output) throw new Error("usage: verify-execution --lane <name> --reports a.json,b.json --output result.json");
  const leaves = verifyReports(root, lane, paths, !process.argv.includes("--partial"));
  const result = { version: 1, lane, leaves: leaves.length, reports: paths.length, reportsSha256: createHash("sha256")
    .update(paths.map((path) => createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex")).join("\n")).digest("hex") };
  writeFileSync(resolve(root, output), `${JSON.stringify(result, null, 2)}\n`);
  console.log(`execution: lane ${lane}, ${leaves.length} passing leaves across ${paths.length} report(s)`);
}
