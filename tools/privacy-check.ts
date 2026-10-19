// Privacy check before a commit or push: scans the lines a change adds for secrets, personal paths and addresses.
//   node tools/privacy-check.ts              the staged change
//   node tools/privacy-check.ts --range A..B  the commits in a range, for example @{u}..HEAD before a push
// A line marked `privacy-ok` is skipped. This finds likely leaks; it is not proof there are none.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RULES: Array<[string, RegExp]> = [
  ["a private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["a token", /\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[abprs]-[A-Za-z0-9-]{10,})/],
  ["a credential assignment", /\b(?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["'][^"'\s]{8,}["']/i],
  ["a personal path", /(?:\/Users\/[A-Za-z0-9._-]+\/|\/home\/[A-Za-z0-9._-]+\/|[A-Za-z]:\\Users\\[A-Za-z0-9._-]+\\)/],
  ["an email address", /\b[A-Za-z0-9._%+-]+@(?!example\.(?:com|test|org)\b|users\.noreply\.github\.com|noreply\.)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/],
];
const ALLOWED_EMAIL = /noreply@anthropic\.com/;
const SECRET_FILE = /(?:^|\/)\.env(?:\.(?!example$).+)?$|\.(?:pem|p12)$|(?:^|\/)id_(?:rsa|ed25519)/;

export interface Finding { file: string; line: number; what: string }

/** Scans unified-diff text: added lines only, and any added file whose name looks like a secret store. */
export function scanDiff(diff: string): Finding[] {
  const out: Finding[] = [];
  let file = "", n = 0;
  for (const l of diff.split("\n")) {
    if (l.startsWith("+++ ")) { file = l.slice(6); if (SECRET_FILE.test(file)) out.push({ file, line: 0, what: "a file that looks like a secret store" }); continue; }
    const h = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(l);
    if (h) { n = Number(h[1]) - 1; continue; }
    if (l.startsWith("+") && !l.startsWith("+++")) {
      n++;
      if (l.includes("privacy-ok")) continue;
      for (const [what, re] of RULES) {
        const m = re.exec(l);
        if (m && !(what === "an email address" && ALLOWED_EMAIL.test(m[0]))) out.push({ file, line: n, what });
      }
    } else if (!l.startsWith("-")) n++;
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--range");
  const args = i > 0 ? ["log", "-p", "--format=", "-U0", process.argv[i + 1]!] : ["diff", "--cached", "-U0"];
  const findings = scanDiff(execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }));
  if (findings.length) {
    console.error(`privacy-check: ${findings.length} possible leak(s)\n${findings.map((f) => `${f.file}:${f.line}: ${f.what}`).join("\n")}`);
    process.exit(1);
  }
  console.log("privacy-check: nothing found in the added lines");
}
