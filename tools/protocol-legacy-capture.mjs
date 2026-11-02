import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "");
const sourceCommit = process.argv[3];
if (!process.argv[2] || !sourceCommit) throw new Error("usage: node tools/protocol-legacy-capture.mjs <capture-dir> <source-commit>");

const sourceTree = execFileSync("git", ["rev-parse", `${sourceCommit}^{tree}`], { encoding: "utf8" }).trim();
execFileSync("git", ["diff", "--quiet", sourceCommit, "--", "packages/kernel/src", "plugin"]);

const files = [];
const effects = new Set();
const effectSources = new Map();
let hasCache = false;
let hasBackupRecovery = false;
let hasInterruptedRecord = false;
const walk = (path) => {
  for (const name of readdirSync(path)) {
    const file = join(path, name);
    const stat = lstatSync(file);
    if (stat.isSymbolicLink()) throw new Error(`unexpected symlink in capture: ${relative(root, file)}`);
    if (stat.isDirectory()) walk(file);
    else if (stat.isFile()) {
      const rel = relative(root, file).replaceAll("\\", "/");
      const bytes = readFileSync(file);
      files.push({ path: rel, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
      if (rel.endsWith("/.tenet/log")) {
        const intents = new Map();
        const results = new Set();
        for (const line of bytes.toString("utf8").split("\n").filter(Boolean)) {
          const record = JSON.parse(line);
          if (record.kind === "intent") {
            effects.add(record.effect);
            const sources = effectSources.get(record.effect) ?? new Set();
            sources.add(rel.slice(0, -"/.tenet/log".length));
            effectSources.set(record.effect, sources);
            intents.set(`${record.effect}/${record.id}`, record);
          }
          if (record.kind === "result") results.add(`${record.effect}/${record.id}`);
        }
        hasInterruptedRecord ||= [...intents.keys()].some(key => !results.has(key));
      }
      if (rel.endsWith("/.tenet/state")) {
        const state = JSON.parse(bytes.toString("utf8"));
        hasCache ||= Object.values(state.work ?? {}).some(work => Boolean(work.session?.last?.response && Object.keys(work.session.last.response).length));
      }
      if (rel.includes("backup-recovery-before-primary-corruption") && rel.endsWith("/.tenet/state.prev")) hasBackupRecovery = true;
    } else throw new Error(`unsupported capture entry: ${relative(root, file)}`);
  }
};

walk(root);
const expected = ["adopt", "branch", "commit", "dependency", "forget", "hardening", "index-sync", "integration", "scaffold", "undo"];
const missing = expected.filter(effect => !effects.has(effect));
if (missing.length) throw new Error(`capture is incomplete; missing effects: ${missing.join(", ")}`);
if (!hasCache) throw new Error("capture contains no cached-response records");
if (!hasBackupRecovery) throw new Error("capture contains no backup-recovery fixture");
if (!hasInterruptedRecord) throw new Error("capture contains no interrupted effect intent");

const harnessCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const payload = {
  format: "tenet-legacy-capture-v1",
  sourceCommit,
  sourceTree,
  harnessCommit,
  effects: expected,
  effectSources: Object.fromEntries(expected.map(effect => [effect, [...(effectSources.get(effect) ?? [])].sort()])),
  hasCachedResponses: hasCache,
  hasBackupRecovery,
  hasInterruptedRecord,
  runnerLimitations: { dependency: "test-simulated runner; actual pipeline and journal" },
  files: files.sort((a, b) => a.path.localeCompare(b.path)),
};
writeFileSync(join(root, "capture-manifest.json"), JSON.stringify(payload, null, 2) + "\n");

const archive = join(dirname(root), "tenet-legacy-capture.tar.gz");
execFileSync("tar", ["-czf", archive, "-C", root, "."], { stdio: "inherit" });
const compressed = readFileSync(archive);
if (compressed.length > 4 * 1024 * 1024) throw new Error(`capture archive exceeds the 4 MiB log-transfer bound (${compressed.length} bytes)`);

console.log(`TENET_CAPTURE_META ${JSON.stringify({
  format: payload.format,
  sourceCommit,
  sourceTree,
  harnessCommit,
  effects: expected,
  captureDirectories: new Set(files.map(file => file.path.split("/")[0])).size,
  fileCount: files.length,
  hasCachedResponses: hasCache,
  hasBackupRecovery,
  hasInterruptedRecord,
  archiveSha256: createHash("sha256").update(compressed).digest("hex"),
  archiveBytes: compressed.length,
})}`);
const encoded = compressed.toString("base64");
for (let offset = 0; offset < encoded.length; offset += 72) {
  console.log(`TENET_CAPTURE_BASE64 ${encoded.slice(offset, offset + 72)}`);
}
