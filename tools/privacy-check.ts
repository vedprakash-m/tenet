// Privacy check before a commit or push: scans the lines a change adds for secrets, personal paths and addresses.
//   node tools/privacy-check.ts              the staged change
//   node tools/privacy-check.ts --range A..B  the commits in a range, for example @{u}..HEAD before a push
// A line marked `privacy-ok` is skipped. This finds likely leaks; it is not proof there are none.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { withoutGitLocalVars } from "../packages/kernel/src/adapters/git-env.ts";
import { redact } from "../packages/kernel/src/core/redact.ts";

const RULES: Array<[string, RegExp]> = [
  ["a private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["a token", /\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[abprs]-[A-Za-z0-9-]{10,})/],
  ["a credential assignment", /\b(?:password|passwd|secret|api[_-]?key|token)["']?\s*[:=]\s*(?:"(?:\\.|[^"\\\s]){8,}"|'(?:\\.|[^'\\\s]){8,}')/i],
  ["a personal path", /(?:\/Users\/[A-Za-z0-9._-]+\/|\/home\/[A-Za-z0-9._-]+\/|[A-Za-z]:\\Users\\[A-Za-z0-9._-]+\\)/],
];
const EMAIL = /\b[A-Za-z0-9._%+-]+@(?!example\.(?:com|test|org)\b|users\.noreply\.github\.com|noreply\.)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const ALLOWED_EMAIL = "noreply@anthropic.com";
const SECRET_FILE = /(?:^|\/)\.env(?:\.(?!example$).+)?$|\.(?:pem|p12)$|(?:^|\/)id_(?:rsa|ed25519)/;
const SECRET_STORE = "a file that looks like a secret store";

export interface Finding { file: string; line: number; what: string }

/** Git's C-style quoting of a path with unusual bytes: `"b/caf\303\251"` → `b/café`. */
function unquote(path: string): string {
  if (!path.startsWith('"')) return path;
  const bytes: number[] = [];
  for (let i = 1; i < path.length - 1; i++) {
    if (path[i] !== "\\") { bytes.push(...Buffer.from(path[i]!, "utf8")); continue; }
    const octal = /^[0-7]{3}/.exec(path.slice(i + 1));
    if (octal) { bytes.push(parseInt(octal[0], 8)); i += 3; continue; }
    const c = path[++i]!;
    bytes.push(({ n: 10, t: 9, '"': 34, "\\": 92 } as Record<string, number>)[c] ?? c.charCodeAt(0));
  }
  return Buffer.from(bytes).toString("utf8");
}

const shown = (file: string) => redact(file); // a file name can itself hold a secret

/** Secret-store files among changed paths. Raw paths, so binary and quoted names are seen too. */
export function scanNames(names: readonly string[]): Finding[] {
  return names.filter((name) => SECRET_FILE.test(name)).map((name) => ({ file: shown(name), line: 0, what: SECRET_STORE }));
}

/**
 * Scans unified-diff text: added lines only, and any added file whose name looks like a secret store.
 * A `+++` line is a file header only before a file's first hunk; inside a hunk it is an added line starting with `++`.
 */
export function scanDiff(diff: string): Finding[] {
  const out: Finding[] = [];
  let file = "", n = 0, header = true;
  for (const l of diff.split("\n")) {
    if (l.startsWith("diff --git ")) { header = true; continue; }
    if (header && l.startsWith("+++ ")) {
      const name = unquote(l.slice(4));
      file = shown(name.replace(/^b\//, ""));
      if (SECRET_FILE.test(name)) out.push({ file, line: 0, what: SECRET_STORE });
      continue;
    }
    const h = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(l);
    if (h) { n = Number(h[1]) - 1; header = false; continue; }
    if (header) continue;
    if (l.startsWith("+")) {
      n++;
      if (l.includes("privacy-ok")) continue;
      for (const [what, re] of RULES) if (re.test(l)) out.push({ file, line: n, what });
      if ([...l.matchAll(EMAIL)].some((m) => m[0] !== ALLOWED_EMAIL)) out.push({ file, line: n, what: "an email address" });
    } else if (!l.startsWith("-")) n++;
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--range");
  const range = i > 0 ? process.argv[i + 1] : undefined;
  if (i > 0 && (!range || range.startsWith("-"))) {
    console.error("privacy-check: --range needs a revision range such as @{u}..HEAD, not an option");
    process.exit(2);
  }
  // A range follows the first-parent line and shows each merge against its first parent, so a line only a merge adds is scanned.
  const pick = range ? ["log", "--first-parent", "--diff-merges=first-parent", "--format=", "--end-of-options", range] : ["diff", "--cached"];
  const git = (args: string[]) => execFileSync("git", args, { env: withoutGitLocalVars(process.env), encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  const [command, ...rest] = pick;
  const findings = scanDiff(git([command!, "-p", "-U0", ...rest]));
  const named = new Set(findings.filter((f) => f.what === SECRET_STORE).map((f) => f.file));
  const names = git([command!, "--name-only", "-z", "--diff-filter=ACMR", ...rest]).split("\0").filter(Boolean);
  findings.push(...scanNames(names).filter((f) => !named.has(f.file)));
  if (findings.length) {
    console.error(`privacy-check: ${findings.length} possible leak(s)\n${findings.map((f) => `${f.file}:${f.line}: ${f.what}`).join("\n")}`);
    process.exit(1);
  }
  console.log("privacy-check: nothing found in the added lines");
}
