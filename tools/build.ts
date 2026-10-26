// Build (TS §3.2): typecheck, bundle the kernel into one file the plugin ships, generate the JSON schemas the skills
// and the reviewer read, and enforce the size budget. The bundle has no runtime dependencies besides Node.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { build } from "esbuild";
import { z } from "zod";
import { Policy } from "../packages/kernel/src/core/policy.ts";
import { ReviewResult } from "../packages/kernel/src/core/schemas.ts";
import { payloadChecksums } from "./payload.ts";

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "plugin/kernel/tenet.mjs");
const BUDGET_BYTES = 800 * 1024; // owner decision 2026-10-24 (was 750 KB, set 2026-10-19); zod is 447 KB of it (TS §3.2)

const SUMS = join(ROOT, "plugin/SHA256SUMS");
rmSync(SUMS, { force: true });
execFileSync(process.execPath, [join(ROOT, "node_modules/typescript/bin/tsc"), "--noEmit"], { cwd: ROOT, stdio: "inherit" });

mkdirSync(dirname(OUT), { recursive: true });
for (const name of ["LICENSE", "NOTICE"]) copyFileSync(join(ROOT, name), join(ROOT, "plugin", name));
await build({
  entryPoints: [join(ROOT, "packages/kernel/src/main.ts")], outfile: OUT, bundle: true, platform: "node", format: "esm", target: "node22",
  minify: true, legalComments: "none", banner: { js: "#!/usr/bin/env node" }, logLevel: "warning",
});

mkdirSync(join(ROOT, "plugin/schemas"), { recursive: true });
writeFileSync(join(ROOT, "plugin/schemas/review-result.schema.json"), `${JSON.stringify(z.toJSONSchema(ReviewResult), null, 2)}\n`);
writeFileSync(join(ROOT, "plugin/schemas/tenet.policy.schema.json"), `${JSON.stringify(z.toJSONSchema(Policy), null, 2)}\n`); // adoption writes a $schema reference to it (TS §7.8)

const size = statSync(OUT).size;
console.log(`build: plugin/kernel/tenet.mjs ${(size / 1024).toFixed(0)} KB (budget ${BUDGET_BYTES / 1024} KB)`);
if (size > BUDGET_BYTES) { console.error("build: bundle exceeds its size budget"); process.exit(1); }

const inventory: unknown = JSON.parse(readFileSync(join(ROOT, "tools/payload-files.json"), "utf8"));
const sums = payloadChecksums(join(ROOT, "plugin"), inventory);
writeFileSync(SUMS, sums);
console.log(`build: ${sums.trimEnd().split("\n").length} payload files recorded in SHA256SUMS`);
