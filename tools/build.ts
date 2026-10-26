// Build (TS §3.2): typecheck, bundle the kernel into one file the plugin ships, generate the JSON schemas the skills
// and the reviewer read, and enforce the size budget. The bundle has no runtime dependencies besides Node.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { z } from "zod";
import { Policy } from "../packages/kernel/src/core/policy.ts";
import { ReviewResult } from "../packages/kernel/src/core/schemas.ts";
import { payloadChecksums, payloadFiles, payloadInventory } from "./payload.ts";

const BUDGET_BYTES = 800 * 1024; // owner decision 2026-10-24 (was 750 KB, set 2026-10-19); zod is 447 KB of it (TS §3.2)
export const GENERATED = ["LICENSE", "NOTICE", "kernel/tenet.mjs", "schemas/review-result.schema.json", "schemas/tenet.policy.schema.json"];

function copySources(root: string, output: string, inventory: string[]): void {
  const source = join(root, "plugin");
  const rel = relative(source, output);
  if (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel)) {
    throw new Error("independent output must be outside the source payload");
  }
  if (existsSync(output)) {
    if (lstatSync(output).isSymbolicLink() || !lstatSync(output).isDirectory()) throw new Error("invalid build output directory");
    if (readdirSync(output).length) throw new Error("independent build output directory must be empty");
  } else mkdirSync(output, { recursive: true });
  const actual = new Set(payloadFiles(source));
  for (const path of actual) if (!inventory.includes(path)) throw new Error(`unexpected payload file: ${path}`);
  for (const path of inventory.filter(path => !GENERATED.includes(path))) {
    if (!actual.has(path)) throw new Error(`missing payload file: ${path}`);
    mkdirSync(dirname(join(output, path)), { recursive: true });
    copyFileSync(join(source, path), join(output, path));
  }
}

export async function buildPayload(root: string, output = join(root, "plugin")): Promise<void> {
  const source = resolve(root, "plugin");
  output = resolve(output);
  const sumsPath = join(output, "SHA256SUMS");
  if (output === source) rmSync(sumsPath, { force: true });
  const inventory = payloadInventory(JSON.parse(readFileSync(join(root, "tools/payload-files.json"), "utf8")));
  if (output !== source) copySources(root, output, inventory);
  execFileSync(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "--noEmit"], { cwd: root, stdio: "inherit" });

  const bundle = join(output, "kernel/tenet.mjs");
  mkdirSync(dirname(bundle), { recursive: true });
  for (const name of ["LICENSE", "NOTICE"]) copyFileSync(join(root, name), join(output, name));
  await build({
    entryPoints: [join(root, "packages/kernel/src/main.ts")], outfile: bundle, bundle: true, platform: "node", format: "esm", target: "node22",
    minify: true, legalComments: "none", banner: { js: "#!/usr/bin/env node" }, logLevel: "warning",
  });

  mkdirSync(join(output, "schemas"), { recursive: true });
  writeFileSync(join(output, "schemas/review-result.schema.json"), `${JSON.stringify(z.toJSONSchema(ReviewResult), null, 2)}\n`);
  writeFileSync(join(output, "schemas/tenet.policy.schema.json"), `${JSON.stringify(z.toJSONSchema(Policy), null, 2)}\n`);
  const size = statSync(bundle).size;
  console.log(`build: plugin/kernel/tenet.mjs ${(size / 1024).toFixed(0)} KB (budget ${BUDGET_BYTES / 1024} KB)`);
  if (size > BUDGET_BYTES) throw new Error("build: bundle exceeds its size budget");
  const sums = payloadChecksums(output, inventory);
  writeFileSync(sumsPath, sums);
  console.log(`build: ${inventory.length} payload files recorded in SHA256SUMS`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await buildPayload(join(import.meta.dirname, ".."));
