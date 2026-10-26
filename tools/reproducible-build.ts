import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { version as esbuildVersion } from "esbuild";
import { buildPayload, GENERATED } from "./build.ts";
import { payloadFiles, payloadInventory, verifyPayload } from "./payload.ts";

function inputSnapshot(root: string): string {
  const paths = [
    "LICENSE", "NOTICE", "package.json", "package-lock.json", "tsconfig.json",
    "node_modules/typescript/package.json", "node_modules/typescript/bin/tsc",
    ...payloadFiles(join(root, "node_modules/typescript/lib")).map(path => `node_modules/typescript/lib/${path}`),
    ...["packages", "tools"].flatMap(dir => payloadFiles(join(root, dir)).map(path => `${dir}/${path}`)),
    ...payloadFiles(join(root, "plugin")).filter(path => !GENERATED.includes(path)).map(path => `plugin/${path}`),
  ].sort();
  return JSON.stringify(paths.map(path => [path, createHash("sha256").update(readFileSync(join(root, path))).digest("hex")]));
}

export async function verifyReproducible(
  root: string, scratch: string, build: (root: string, output: string) => Promise<void> = buildPayload,
): Promise<{ files: number; manifestSha256: string; node: string; esbuild: string; typescript: string }> {
  const inventory = payloadInventory(JSON.parse(readFileSync(join(root, "tools/payload-files.json"), "utf8")));
  const before = inputSnapshot(root);
  const typescript: string = JSON.parse(readFileSync(join(root, "node_modules/typescript/package.json"), "utf8")).version;
  mkdirSync(scratch, { recursive: true });
  const owned = mkdtempSync(join(realpathSync(scratch), "reproducible-"));
  try {
    const outputs = ["first", "second"].map(name => join(owned, name));
    for (const output of outputs) {
      mkdirSync(output);
      await build(root, output);
    }
    if (inputSnapshot(root) !== before) throw new Error("reproducible build inputs changed during verification");
    for (const output of outputs) verifyPayload(output, inventory);
    const [first, second] = outputs.map(output => readFileSync(join(output, "SHA256SUMS"), "utf8"));
    if (first !== second) throw new Error("reproducible build payloads differ");
    return {
      files: inventory.length, manifestSha256: createHash("sha256").update(first!).digest("hex"),
      node: process.version, esbuild: esbuildVersion, typescript,
    };
  } finally {
    rmSync(owned, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(import.meta.dirname, "..");
  const result = await verifyReproducible(root, join(root, ".host-runs/test-fixtures"));
  console.log(`reproducible: ${JSON.stringify(result)} (same source and installed toolchain, independent empty outputs only)`);
}
