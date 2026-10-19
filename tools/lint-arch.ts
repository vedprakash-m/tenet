// Architecture lint (TS §6.1, §3.2): a small import scanner, not a linter framework. Rules:
//  - core/ imports no adapter, no verb, no pipeline, and does no I/O (only zod, node:crypto, ports types);
//  - only adapters/, wire.ts and main.ts touch the filesystem, processes, OS or network;
//  - nothing evaluates code: no vm, worker_threads, eval, new Function, computed import();
//  - only core/verdict.ts sets an endpoint, only core/budget.ts changes a counter.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const listFiles = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? listFiles(p) : p.endsWith(".ts") ? [p] : [];
});

const IO = /^node:(fs|fs\/promises|child_process|os|net|http|https|http2|dgram|tls|dns|cluster|readline|stream|process)$/;
const ALWAYS_BANNED = /^node:(vm|worker_threads)$/;
const ADAPTER_SIDE = (rel: string) => rel.startsWith("adapters/") || rel === "wire.ts" || rel === "main.ts";
const COUNTERS = /\b(attempts|reviewRounds|rechecks|delegations|checksLaunched)\s*[:=]\s*\w+\.(attempts|reviewRounds|rechecks|delegations|checksLaunched)\s*\+/;

export function lintArch(SRC: string): { problems: string[]; files: number } {
const problems: string[] = [];
const add = (rel: string, line: number, msg: string) => problems.push(`${rel}:${line}: ${msg}`);
const all = listFiles(SRC);
for (const file of all) {
  const rel = relative(SRC, file);
  const text = readFileSync(file, "utf8");
  text.split("\n").forEach((src, i) => {
    const n = i + 1;
    const code = src.replace(/\/\/.*$/, "");
    for (const m of code.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
      const spec = m[1]!;
      if (ALWAYS_BANNED.test(spec)) add(rel, n, `${spec} is banned everywhere`);
      if (IO.test(spec) && !ADAPTER_SIDE(rel)) add(rel, n, `${spec}: I/O belongs in adapters/ behind a port`);
      if (rel.startsWith("core/")) {
        if (spec.startsWith(".") && !/^\.\/[\w-]+\.ts$/.test(spec) && !/^\.\.\/ports\/types\.ts$/.test(spec)) add(rel, n, `core/ may import only core/ and ports types, not ${spec}`);
        if (spec === "../ports/types.ts" && !/import type/.test(code)) add(rel, n, "core/ imports ports as types only");
        if (!spec.startsWith(".") && spec !== "zod" && spec !== "node:crypto") add(rel, n, `core/ may import only zod and node:crypto, not ${spec}`);
      }
      if (!rel.startsWith("adapters/") && /(^|\/)adapters\//.test(spec) && rel !== "wire.ts") add(rel, n, "only the composition root imports adapters");
    }
    if (/\bimport\s*\(\s*[^"'\s]/.test(code)) add(rel, n, "computed dynamic import()");
    if (/\bimport\s*\(\s*["']/.test(code) && !rel.startsWith("adapters/")) add(rel, n, "dynamic import() outside adapters");
    if (/\beval\s*\(|new\s+Function\s*\(/.test(code)) add(rel, n, "code evaluation");
    // Remote effects exist only on explicit request and arrive with `publish` after M0 (GIT-05): until then none is possible.
    if (rel.startsWith("adapters/git-cli") && /["'](push|fetch|pull|clone|ls-remote|send-pack)["']/.test(code)) add(rel, n, "remote Git operations are not part of M0");
    if (/endpoint\s*[:=]\s*["'](blocked|findings-only|implemented-unverified|checked-local|prototype)["']/.test(code) && rel !== "core/verdict.ts") add(rel, n, "only core/verdict.ts produces an endpoint");
    if (COUNTERS.test(code) && rel !== "core/budget.ts") add(rel, n, "only core/budget.ts changes a counter");
  });
  if (rel.startsWith("frontends/") && /\b(verdict|budget|grant)\w*\s*\(/.test(text.replace(/\/\/.*$/gm, ""))) add(rel, 1, "front-ends hold no verdict, authority or budget logic");
}

return { problems, files: all.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { problems, files } = lintArch(join(import.meta.dirname, "../packages/kernel/src"));
  if (problems.length) {
    console.error(`lint-arch: ${problems.length} problem(s)\n${problems.join("\n")}`);
    process.exit(1);
  }
  console.log(`lint-arch: ${files} files, no problems`);
}
