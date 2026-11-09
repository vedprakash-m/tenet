// Reference fixtures for the §4.4.3 budgets (NFR-01, AC-19): small, large and long-history repositories.
// Nothing is committed: each is generated from the numbers below, so two runs give the same HEAD. The sizes are a
// proposal until the owner freezes them (PRD Q-06); changing one changes what "frozen" means for every stored result.
import { withoutGitLocalVars } from "../packages/kernel/src/adapters/git-env.ts";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

export interface FixtureSpec {
  /** Tracked source files under dN/fM.ts, 100 per directory. */
  files: number;
  /** Commits on `main`, counting the first. */
  commits: number;
  /** Kernel contracts opened beforehand so `.tenet/` carries history; used by tools/bench.ts, not by Git. */
  contracts: number;
}

export const FIXTURES = {
  small: { files: 200, commits: 20, contracts: 0 },
  large: { files: 10_000, commits: 50, contracts: 0 }, // 10,000 is the repository-map bound in PRD §4.4.3
  "long-history": { files: 1_000, commits: 5_000, contracts: 200 },
} as const satisfies Record<string, FixtureSpec>;
export type FixtureName = keyof typeof FIXTURES;

const PER_DIR = 100;
const IDENT = "Tenet Bench <bench@example.test>";
const FIRST_COMMIT_AT = 1_700_000_000;

export const gitEnv = (): NodeJS.ProcessEnv => ({
  ...withoutGitLocalVars(process.env), GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null", GIT_CONFIG_NOSYSTEM: "1",
});

const pathOf = (n: number) => `d${Math.floor(n / PER_DIR)}/f${n % PER_DIR}.ts`;
const textOf = (n: number, revision = 0) => `export const v${n} = ${(n * 2_654_435_761) >>> 0};\n${revision ? `// revision ${revision}\n` : ""}`;
const entry = (path: string, text: string) => `M 100644 inline ${path}\ndata ${Buffer.byteLength(text)}\n${text}\n`;

/** One `git fast-import` stream: a base commit with every file, then one-file edits, each with a fixed author time. */
function stream(spec: FixtureSpec): Buffer {
  const out: string[] = [];
  for (let c = 0; c < spec.commits; c++) {
    const message = `bench commit ${c}`;
    out.push(`commit refs/heads/main\nauthor ${IDENT} ${FIRST_COMMIT_AT + c * 60} +0000\ncommitter ${IDENT} ${FIRST_COMMIT_AT + c * 60} +0000\ndata ${message.length}\n${message}\n`);
    if (c === 0) {
      out.push(entry("package.json", '{"name":"bench","type":"module","private":true}\n'), entry("tsconfig.json", '{"compilerOptions":{"strict":true}}\n'));
      out.push(entry(".gitignore", "node_modules\n.tenet/\n"), entry("src/greet.ts", 'export const greet = (_name: string): string => "";\n'));
      for (let n = 0; n < spec.files; n++) out.push(entry(pathOf(n), textOf(n)));
    } else {
      const n = (c * 7_919) % spec.files;
      out.push(entry(pathOf(n), textOf(n, c)));
    }
    out.push("\n");
  }
  return Buffer.from(out.join(""), "utf8");
}

const run = (dir: string, args: string[], input?: Buffer) =>
  execFileSync("git", args, { cwd: dir, env: gitEnv(), input, maxBuffer: 1 << 28, stdio: ["pipe", "pipe", "pipe"] }).toString().trim();

/** Per-repository settings, so nothing depends on the developer's Git configuration; a clone needs them again. */
export function configureRepo(dir: string): void {
  for (const [key, value] of [["user.name", "Tenet Bench"], ["user.email", "bench@example.test"], ["commit.gpgsign", "false"], ["core.autocrlf", "false"]]) run(dir, ["config", key!, value!]);
}

/** Builds the repository in `dir` (created if missing) and checks `main` out. Returns HEAD so callers can compare runs;
 *  `files` counts every tracked path, which is `spec.files` plus four project files. */
export function generateFixture(spec: FixtureSpec, dir: string): { head: string; files: number; commits: number } {
  mkdirSync(dir, { recursive: true });
  const git = (args: string[], input?: Buffer) => run(dir, args, input);
  git(["init", "-q", "-b", "main"]);
  configureRepo(dir);
  git(["fast-import", "--quiet"], stream(spec));
  git(["reset", "-q", "--hard"]);
  return { head: git(["rev-parse", "HEAD"]), files: git(["ls-files"]).split("\n").length, commits: Number(git(["rev-list", "--count", "HEAD"])) };
}
