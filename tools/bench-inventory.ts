// Inventory latency at scale (TS §14.1, SP-06): node tools/bench-inventory.ts [files] [dirty]
// Builds a throwaway repository, then times the inventory clean and with some files edited. Not part of CI.
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GitCli } from "../packages/kernel/src/adapters/git-cli.ts";

const files = Number(process.argv[2] ?? 10_000), dirty = Number(process.argv[3] ?? 500);
const root = mkdtempSync(join(tmpdir(), "tenet-bench-"));
const git = (...a: string[]) => execFileSync("git", a, { cwd: root, stdio: "pipe", maxBuffer: 1 << 28 });
try {
  git("init", "-q");
  const per = 100;
  for (let d = 0; d < files / per; d++) {
    mkdirSync(join(root, `d${d}`), { recursive: true });
    for (let f = 0; f < per; f++) writeFileSync(join(root, `d${d}/f${f}.ts`), `export const x${f} = ${d};\n`);
  }
  git("add", "-A"); git("-c", "user.name=b", "-c", "user.email=b@example.test", "commit", "-qm", "bench");
  const g = new GitCli(root);
  const time = async (label: string) => { const t = performance.now(); await g.inventory([]); console.log(`${label}: ${(performance.now() - t).toFixed(0)} ms`); };
  console.log(`${files} files`);
  for (let i = 0; i < 3; i++) await time("clean inventory");
  for (let i = 0; i < dirty; i++) appendFileSync(join(root, `d${i % (files / per)}/f${i % per}.ts`), "// edit\n");
  for (let i = 0; i < 3; i++) await time(`${dirty} files edited`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
