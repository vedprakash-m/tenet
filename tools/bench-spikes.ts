// Temporary (NFR-01 work): where do the occasional ~500 ms warm calls on long-history come from?
//   node tools/bench-spikes.ts <bundle> <out-dir>
// Runs the bench workload on long-history and records every call's time, the kernel's own active time, the
// system's dirty page cache before the call, and (under strace, when present) the fsync and fdatasync durations.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FIXTURES, generateFixture, gitEnv } from "./bench-fixtures.ts";

const [bundle, out] = [process.argv[2]!, process.argv[3]!];
mkdirSync(out, { recursive: true });
const source = join(out, "repo");
generateFixture(FIXTURES["long-history"], source);
const strace = process.argv[4] !== "plain" && spawnSync("strace", ["-V"]).status === 0;
const dirty = () => /Dirty:\s+(\d+)/.exec(readFileSync("/proc/meminfo", "utf8"))?.[1] + " kB";
const BASIS = { outcome: "Return a greeting", scopePaths: ["src/"], elements: [
  { ref: "r", kind: "requirement", origin: "request", text: "greet returns Hello, Ada!" },
  { ref: "e", kind: "example", origin: "request", of: "r", text: "greet Ada", testFile: "src/greet.test.ts", test: "distinguishing", expect: "fail" },
] };
const lines: string[] = [];
let n = 0;
function call(label: string, argv: string[], body?: object, record = true): { handle?: string } {
  const env = gitEnv(); delete env.NODE_OPTIONS;
  const trace = join(out, `call-${++n}.strace`), before = dirty();
  const args = strace && record ? ["-f", "-T", "-e", "trace=fsync,fdatasync,rename,link", "-o", trace, process.execPath, bundle, ...argv] : [bundle, ...argv];
  const t = performance.now();
  const r = spawnSync(strace && record ? "strace" : process.execPath, args, { cwd: source, env, input: body ? JSON.stringify(body) : "", encoding: "utf8", maxBuffer: 1 << 26 });
  const ms = performance.now() - t;
  let resp: { handle?: string; exit?: number; timing?: { active?: { ms?: number } } } = {};
  try { resp = JSON.parse(r.stdout); } catch { /* reported below */ }
  if (record) {
    let syncs = "";
    try {
      const ts = readFileSync(trace, "utf8").split("\n").map((l) => /^(\d+)\s+(\w+)\(.*<([\d.]+)>$/.exec(l)).filter((m) => m);
      const fs = ts.filter((m) => /sync/.test(m![2]!)).map((m) => Number(m![3]) * 1000);
      syncs = `fsyncs ${fs.length} total ${fs.reduce((a, b) => a + b, 0).toFixed(1)} ms max ${Math.max(0, ...fs).toFixed(1)} ms`;
    } catch { /* no strace */ }
    lines.push(`${String(n).padStart(4)} ${label.padEnd(18)} ${ms.toFixed(0).padStart(5)} ms exit ${resp.exit} active ${resp.timing?.active?.ms?.toFixed(0)} ms dirty-before ${before} ${syncs}`);
  }
  return resp;
}
const h = call("open feature", ["open"], { profile: "feature", request: "bench", lane: "quick" }).handle ?? "";
for (let i = 0; i < FIXTURES["long-history"].contracts; i++) call("history", ["open"], { profile: "investigate", request: `history ${i}` }, i % 50 === 49);
lines.push(`--- after history: dirty ${dirty()}`);
call("decide basis", ["decide"], { h, kind: "basis", propose: BASIS });
for (let i = 0; i < 2; i++) call("status (discarded)", ["inspect", "status", "--h", h]);
for (let i = 0; i < 20; i++) { call("status", ["inspect", "status", "--h", h]); call("open investigate", ["open"], { profile: "investigate", request: `warm ${i}` }); }
call("stop pause", ["stop", "pause", "--h", h]);
lines.push(`--- .tenet: ${execFileSync("du", ["-sh", join(source, ".tenet")], { encoding: "utf8" }).trim()}`);
lines.push(execFileSync("sh", ["-c", `ls -la ${join(source, ".tenet")}`], { encoding: "utf8" }));
lines.push(`--- strace: ${strace}; mounts: ${execFileSync("sh", ["-c", "findmnt -T " + out + " -o SOURCE,FSTYPE,OPTIONS"], { encoding: "utf8" })}`);
writeFileSync(join(out, "spikes.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
