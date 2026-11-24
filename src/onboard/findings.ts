import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { confine } from "../core/fs.js";
import { sha256 } from "../core/hash.js";
import { onboardText } from "../core/messages.js";
import { readReport, scanTests } from "../reports/index.js";
import type { TestReport } from "../reports/types.js";
import type { Inventory } from "../types/generated.js";
import { ascii, object, ownerMatcher, type Facts } from "./inventory.js";

type FirstFinding = Inventory["findings"][number];
type Report = Inventory["observations"]["reports"][number];

const findingOrder = ["dead-path", "skipped-tests", "owners-unmatched", "no-test-report"] as const;
const reportsDirectory = ".tenet/reports";
const reportLimit = 50 * 1024 * 1024;
const names: Readonly<Record<string, TestReport["runner"]>> = {
  "junit.xml": "junit",
  "ctrf.json": "ctrf",
  "go-test.json": "go-test-json",
  "go-test-json.json": "go-test-json",
  "jest.json": "jest-json",
  "jest-json.json": "jest-json",
};

function referencedPaths(text: string): string[] {
  const markdown = text.replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[ \t]*$/gm, "");
  const links = [...markdown.matchAll(/\[[^\]\n]*\]\(\s*(?:<([^>\n]+)>|([^\s)]+))/g)]
    .flatMap((entry) => entry[1] ?? entry[2] ?? []);
  const named = [...markdown.matchAll(/(?<!`)`([^`\n]+)`(?!`)/g)]
    .map((entry) => entry[1] ?? "")
    .filter((entry) => /^(?:\.\.?\/)?[\w.@/-]+\.[\w-]+(?::\d+(?:-\d+)?)?$/.test(entry));
  return [...new Set([...links, ...named])];
}

function localTarget(value: string): string | undefined {
  if (/^(?:#|\/\/|[a-z][a-z+\d.-]*:)/i.test(value)) return undefined;
  const bare = value.split(/[?#]/, 1)[0]?.replace(/:\d+(?:-\d+)?$/, "");
  if (!bare) return undefined;
  try { return decodeURIComponent(bare); }
  catch { return bare; }
}

function deadPaths(facts: Facts, tracked: Set<string>): FirstFinding[] {
  const directories = new Set<string>(["."]);
  for (const file of tracked) {
    for (let parent = path.posix.dirname(file); !directories.has(parent); parent = path.posix.dirname(parent)) {
      directories.add(parent);
    }
  }
  return facts.files.filter(({ kind }) => kind === "doc" || kind === "adr").flatMap((doc) => {
    const targets = new Set(referencedPaths(doc.text).flatMap((reference) => localTarget(reference) ?? []));
    return [...targets].flatMap((target) => {
      const local = path.posix.normalize(path.posix.join(path.posix.dirname(doc.path), target)).replace(/\/$/, "");
      const root = path.posix.normalize(target.replace(/^\//, "")).replace(/\/$/, "");
      const candidates = target.startsWith("/") ? [root] : target.startsWith(".") ? [local] : [local, root];
      if (candidates.some((candidate) => tracked.has(candidate) || directories.has(candidate))) return [];
      return [{ kind: "dead-path", path: doc.path, message: onboardText.deadPath(doc.path, target) }];
    });
  });
}

function runnerFor(filename: string, text: string, facts: Facts): string {
  if (filename.endsWith(".py")) return "pytest";
  if (filename.endsWith(".go")) return "go";
  if (filename.endsWith(".java")) return "junit";
  if (filename.endsWith(".rs")) return "cargo";
  if (/["']node:test["']/.test(text)) return "node:test";
  if (/["'](?:vitest|@vitest\/[^"']+)["']/.test(text)) return "vitest";
  if (/["']@jest\/globals["']/.test(text)) return "jest";
  if (facts.files.some((file) => /(?:^|\/)vitest\.config\./.test(file.path))) return "vitest";
  if (facts.files.some((file) => /(?:^|\/)jest\.config\./.test(file.path))) return "jest";
  return "node:test";
}

function literalGlob(filename: string): string {
  const delimiters = new Map([["[", "[[]"], ["]", "[]]"], ["*", "[*]"], ["?", "[?]"],
    ["(", "[(]"], [")", "[)]"], ["{", "[{]"], ["}", "[}]"], ["+", "[+]"], ["!", "[!]"], ["@", "[@]"]]);
  return filename.replace(/[\[\]*?(){}+!@]/g, (char) => delimiters.get(char) ?? char);
}

function recognizedRunner(facts: Facts): boolean {
  const commands = [...facts.inventory.ci.flatMap(({ commands }) => commands), ...Object.values(facts.policy.checks ?? {}).map(({ run }) => run)];
  for (const file of facts.files.filter(({ path: filename }) => path.posix.basename(filename) === "package.json")) {
    try {
      const scripts = object(object(JSON.parse(file.text)).scripts);
      commands.push(...Object.entries(scripts).flatMap(([name, run]) => (name === "test" || name.startsWith("test:")) && typeof run === "string" ? [run] : []));
    } catch { /* An unreadable manifest cannot establish a runner. */ }
  }
  return commands.some((command) => /(?:^|[\s/])(?:vitest|jest|pytest)(?=[\s;&|]|$)|\bgo\s+test\b|\bnode\s+--test\b/.test(command));
}

async function observeReports(facts: Facts): Promise<Report[]> {
  const { cwd } = facts.snapshot;
  const candidates = new Map<string, string>();
  for (const [name, check] of Object.entries(facts.policy.checks ?? {})) {
    if (check.report !== "none") {
      const filename = check.report_path ?? `${reportsDirectory}/${name}.${check.report === "junit" ? "xml" : "json"}`;
      candidates.set(filename.replaceAll("\\", "/").replace(/^\.\//, ""), check.report);
    }
  }
  const directory = await confine(reportsDirectory, cwd);
  let local: string[];
  try { local = await readdir(directory); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    local = [];
  }
  for (const name of local) {
    const runner = Object.hasOwn(names, name) ? names[name] : /\.xml$/i.test(name) ? "junit" : undefined;
    const relative = `${reportsDirectory}/${name}`;
    if (runner && !candidates.has(relative)) candidates.set(relative, runner);
  }

  const reports: Report[] = [];
  for (const [relative, runner] of [...candidates].sort(([first], [second]) => ascii(first, second))) {
    const filename = await confine(relative, cwd);
    try {
      const stat = await lstat(filename);
      if (!stat.isFile() || stat.size > reportLimit) continue;
      const bytes = await readFile(filename);
      if (bytes.length > reportLimit) continue;
      const result = readReport(runner, filename, { cwd, prefix: facts.policy.specs?.id_prefix ?? "R" });
      const digest = sha256(bytes);
      if (sha256(await readFile(filename)) !== digest) continue;
      reports.push({ path: relative, sha256: digest, runner, cases: result.cases.length });
    } catch (error) {
      if (!["ENOENT", "ENOTDIR", "TN-REPORT-MISSING", "TN-REPORT-MALFORMED"].includes(String((error as NodeJS.ErrnoException).code))) throw error;
    }
  }
  return reports;
}

export async function firstFindings(facts: Facts, ref = facts.snapshot.revision): Promise<Pick<Inventory, "tests" | "findings" | "observations">> {
  const trackedTestFiles = facts.files.filter(({ kind, path: filename }) => kind === "test" && !/[\\\r\n]/.test(filename));
  const selected = trackedTestFiles.map(({ path: filename }) => literalGlob(filename));
  const [scan, reports] = await Promise.all([
    selected.length ? scanTests(ref, { cwd: facts.snapshot.cwd, id_prefix: facts.policy.specs?.id_prefix ?? "R", test_files: selected }) :
      { declarations: [], skips: [] },
    observeReports(facts),
  ]);
  const counts = new Map<string, number>();
  const skips = new Map<string, number>();
  for (const { file } of scan.declarations) counts.set(file, (counts.get(file) ?? 0) + 1);
  for (const { file } of scan.skips) skips.set(file, (skips.get(file) ?? 0) + 1);

  const tracked = new Set(facts.snapshot.files.map((file) => file.path));
  const findings = deadPaths(facts, tracked);
  for (const [file, count] of skips) {
    findings.push({ kind: "skipped-tests", path: file, message: onboardText.skippedTests(count, file) });
  }
  if (facts.codeowners) {
    for (const { pattern } of facts.inventory.owners) {
      const match = ownerMatcher(pattern);
      if (![...tracked].some(match)) {
        findings.push({ kind: "owners-unmatched", path: facts.codeowners, message: onboardText.ownersUnmatched(pattern) });
      }
    }
  }
  const configured = Object.values(facts.policy.checks ?? {}).some((check) => check.report !== "none");
  if (!reports.length && !configured && !recognizedRunner(facts)) {
    findings.push({ kind: "no-test-report", path: facts.inventory.ci[0]?.path ?? "tenet.yaml", message: onboardText.noTestReport });
  }
  findings.sort((a, b) => findingOrder.indexOf(a.kind) - findingOrder.indexOf(b.kind) || ascii(a.path, b.path) || ascii(a.message, b.message));
  return {
    tests: facts.files.filter(({ kind }) => kind === "test").map(({ path: filename, text }) => ({
      path: filename, runner: runnerFor(filename, text, facts), cases: counts.get(filename) ?? 0,
    })),
    findings,
    observations: { reports },
  };
}
