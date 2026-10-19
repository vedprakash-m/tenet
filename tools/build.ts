// Build (TS §3.2): typecheck, bundle the kernel into one file the plugin ships, generate the JSON schemas the skills
// and the reviewer read, and enforce the size budget. The bundle has no runtime dependencies besides Node.
import { execFileSync } from "node:child_process";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { build } from "esbuild";
import { z } from "zod";
import { ReviewResult } from "../packages/kernel/src/core/schemas.ts";

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "plugin/kernel/tenet.mjs");
const BUDGET_BYTES = 600 * 1024;

execFileSync(join(ROOT, "node_modules/.bin/tsc"), ["--noEmit"], { cwd: ROOT, stdio: "inherit" });

mkdirSync(dirname(OUT), { recursive: true });
await build({
  entryPoints: [join(ROOT, "packages/kernel/src/main.ts")], outfile: OUT, bundle: true, platform: "node", format: "esm", target: "node22",
  minify: true, legalComments: "none", banner: { js: "#!/usr/bin/env node" }, logLevel: "warning",
});

mkdirSync(join(ROOT, "plugin/schemas"), { recursive: true });
writeFileSync(join(ROOT, "plugin/schemas/review-result.schema.json"), `${JSON.stringify(z.toJSONSchema(ReviewResult), null, 2)}\n`);

const size = statSync(OUT).size;
console.log(`build: plugin/kernel/tenet.mjs ${(size / 1024).toFixed(0)} KB (budget ${BUDGET_BYTES / 1024} KB)`);
if (size > BUDGET_BYTES) { console.error("build: bundle exceeds its size budget"); process.exit(1); }
