import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface Lane {
  include?: string[]; exclude?: string[]; requiresBundle?: boolean;
  requiredLeaves?: string[]; allowedSkips?: string[]; namePattern?: string;
}
interface Inventory { version: number; root: string; patternSuffix: string; lanes: Record<string, Lane> }
interface Report {
  version: number;
  terminal: { success: boolean; counts: unknown };
  leaves: Array<{ key: string; file: string; status: "pass" | "fail" | "skip"; durationMs: number }>;
  files: Array<{ file: string; pass: number; fail: number; skipped: number; durationMs: number }>;
}

const ROOT = join(import.meta.dirname, "..");
const normalize = (path: string) => path.replaceAll("\\", "/");

export function loadInventory(root = ROOT): { inventory: Inventory; digest: string } {
  const bytes = readFileSync(join(root, "tools/test-inventory.json"), "utf8");
  const inventory = JSON.parse(bytes) as Inventory;
  if (inventory.version !== 1 || typeof inventory.patternSuffix !== "string" || !inventory.lanes || typeof inventory.root !== "string") {
    throw new Error("test inventory: unsupported or malformed");
  }
  return { inventory, digest: createHash("sha256").update(bytes).digest("hex") };
}

const walkTests = (root: string, dir: string, suffix: string): string[] => readdirSync(join(root, dir), { withFileTypes: true })
  .flatMap((entry) => {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) return walkTests(root, rel, suffix);
    return entry.name.endsWith(suffix) ? [normalize(rel)] : [];
  }).sort();

export function selectedFiles(root: string, laneName: string): string[] {
  const { inventory } = loadInventory(root);
  const lane = inventory.lanes[laneName];
  if (!lane) throw new Error(`unknown test lane: ${laneName}`);
  const discovered = walkTests(root, inventory.root, inventory.patternSuffix);
  const included = new Set(lane.include?.map(normalize) ?? discovered);
  const excluded = new Set(lane.exclude?.map(normalize) ?? []);
  const selected = [...included].filter((file) => !excluded.has(file));
  for (const file of selected) {
    const path = join(root, file);
    if (!discovered.includes(file) || !statSync(path).isFile()) throw new Error(`test inventory names non-test file: ${file}`);
  }
  return selected.sort();
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

export async function runTests(root: string, laneName: string, output: string, shard?: string, concurrency = "2"): Promise<number> {
  const { inventory, digest } = loadInventory(root);
  const lane = inventory.lanes[laneName];
  if (!lane) throw new Error(`unknown test lane: ${laneName}`);
  if (lane.requiresBundle) statSync(join(root, "plugin/kernel/tenet.mjs"));
  const files = selectedFiles(root, laneName);
  if (!files.length) throw new Error(`test lane ${laneName} selected no files`);
  const reporter = `./${normalize(relative(root, join(root, "tools/test-reporter.mjs")))}`;
  const args = [
    "--test", `--test-concurrency=${concurrency}`, "--test-reporter", reporter,
    ...((shard) ? [`--test-shard=${shard}`] : []),
    ...((lane.namePattern) ? [`--test-name-pattern=${lane.namePattern}`] : []),
    ...files,
  ];
  const child = spawn(process.execPath, args, { cwd: root, env: process.env, stdio: ["ignore", "pipe", "inherit"] });
  let stdout = "";
  child.stdout!.on("data", (chunk) => { stdout += chunk.toString(); });
  const status = await new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
  let report: Report;
  try { report = JSON.parse(stdout) as Report; }
  catch (error) { throw new Error(`test reporter emitted invalid JSON: ${String(error)}`); }
  const enriched = {
    ...report,
    identity: {
      schemaVersion: 1, lane: laneName, inventorySha256: digest, shard: shard ?? null,
      root: normalize(relative(root, root)), cwd: normalize(process.cwd()),
      node: process.version, sourceFiles: shard ? report.files.map((file) => file.file).sort() : files,
    },
  };
  writeFileSync(resolve(output), `${JSON.stringify(enriched, null, 2)}\n`);
  if (status === 0 && (!report.terminal.success || !report.files.length)) throw new Error("test reporter did not observe a complete run");
  return status;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const lane = argument("--lane") ?? "all";
  const output = argument("--report") ?? join(".host-runs/test-fixtures", `test-${lane}.json`);
  const shard = argument("--shard");
  const concurrency = argument("--concurrency") ?? "2";
  const outputPath = resolve(ROOT, output);
  const parent = dirname(outputPath);
  await import("node:fs/promises").then(({ mkdir }) => mkdir(parent, { recursive: true }));
  process.exitCode = await runTests(ROOT, lane, outputPath, shard, concurrency);
}
