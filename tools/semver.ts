import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { KERNEL_VERSION } from "../packages/kernel/src/version.ts";

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function compare(a: RegExpExecArray, b: RegExpExecArray): number {
  for (let i = 1; i <= 3; i++) {
    const x = BigInt(a[i]!), y = BigInt(b[i]!);
    if (x !== y) return x > y ? 1 : -1;
  }
  if (!a[4] || !b[4]) return a[4] === b[4] ? 0 : a[4] ? -1 : 1;
  const x = a[4].split("."), y = b[4].split(".");
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const left = x[i], right = y[i];
    if (left === undefined || right === undefined) return left === undefined ? -1 : 1;
    if (left === right) continue;
    const ln = /^\d+$/.test(left), rn = /^\d+$/.test(right);
    if (ln && rn) return BigInt(left) > BigInt(right) ? 1 : -1;
    if (ln !== rn) return ln ? -1 : 1;
    return left > right ? 1 : -1;
  }
  return 0;
}

export function versionProblems(plugin: string, kernel: string, previous?: string): string[] {
  const problems: string[] = [];
  const current = SEMVER.exec(plugin), prior = previous === undefined ? null : SEMVER.exec(previous);
  if (!current) problems.push(`invalid plugin SemVer: ${plugin}`);
  if (!SEMVER.test(kernel)) problems.push(`invalid kernel SemVer: ${kernel}`);
  if (plugin !== kernel) problems.push("kernel and plugin versions disagree");
  if (previous !== undefined && !prior) problems.push(`invalid previous SemVer: ${previous}`);
  if (current && prior && compare(current, prior) < 0) problems.push("version regresses from the base");
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const plugin = JSON.parse(readFileSync(join(import.meta.dirname, "../plugin/plugin.json"), "utf8")).version;
  const problems = versionProblems(plugin, KERNEL_VERSION, process.argv[2]);
  if (problems.length) { console.error(problems.join("\n")); process.exitCode = 1; }
  else console.log(`SemVer: ${plugin}, kernel and plugin agree`);
}
