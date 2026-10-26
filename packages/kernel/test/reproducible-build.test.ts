import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { buildPayload } from "../../../tools/build.ts";
import { verifyReproducible } from "../../../tools/reproducible-build.ts";
import { payloadChecksums } from "../../../tools/payload.ts";
import { projectScratch } from "../../../tools/test-scratch.ts";

const ROOT = join(import.meta.dirname, "../../..");
const roots: string[] = [];
after(() => roots.forEach(root => rmSync(root, { recursive: true, force: true })));
const fixture = () => {
  const root = projectScratch("reproducible build-");
  roots.push(root);
  const files = {
    "package.json": '{"type":"module"}',
    "package-lock.json": '{"lockfileVersion":3}',
    "tsconfig.json": JSON.stringify({
      compilerOptions: { strict: true, noEmit: true, target: "ES2023", module: "NodeNext", types: [] },
      include: ["packages/kernel/src/**/*.ts"],
    }),
    "LICENSE": "fixture license\n",
    "NOTICE": "fixture notice\n",
    "plugin/.hidden": "hidden\r\n",
    "plugin/plugin.json": '{"name":"synthetic"}\n',
    "packages/kernel/src/main.ts": "export const answer = 42;",
    "packages/kernel/src/core/policy.ts": 'import { z } from "zod";\nexport const Policy = z.object({ allow: z.boolean() });',
    "packages/kernel/src/core/schemas.ts": 'import { z } from "zod";\nexport const ReviewResult = z.object({ result: z.string() });',
    "tools/payload-files.json": JSON.stringify([
      ".hidden", "LICENSE", "NOTICE", "kernel/tenet.mjs", "plugin.json",
      "schemas/review-result.schema.json", "schemas/tenet.policy.schema.json",
    ]),
  };
  for (const [name, value] of Object.entries(files)) {
    mkdirSync(join(root, name, ".."), { recursive: true });
    writeFileSync(join(root, name), value);
  }
  for (const file of ["build.ts", "payload.ts", "reproducible-build.ts"]) {
    copyFileSync(join(ROOT, "tools", file), join(root, "tools", file));
  }
  symlinkSync(join(ROOT, "node_modules"), join(root, "node_modules"), "junction");
  return root;
};

describe("clean-output payload reproducibility", () => {
  it("builds twice in independent empty output directories without modifying the source payload", async () => {
    const root = fixture(), scratch = projectScratch("repro-owned-");
    roots.push(scratch);
    const result = await verifyReproducible(root, scratch);
    assert.equal(result.files, 7);
    assert.match(result.manifestSha256, /^[a-f0-9]{64}$/);
    assert.equal(result.node, process.version);
    assert.equal(typeof result.esbuild, "string");
    assert.deepEqual(readdirSync(scratch), []);
    assert.deepEqual(readdirSync(join(root, "plugin")).sort(), [".hidden", "plugin.json"]);
    assert.equal(readFileSync(join(root, "plugin/.hidden"), "utf8"), "hidden\r\n");
  });

  it("rejects mismatched build outputs and cleans only its two owned directories", async () => {
    const root = fixture(), scratch = projectScratch("repro-owned-");
    roots.push(scratch);
    writeFileSync(join(scratch, "keep.txt"), "human file");
    let builds = 0;
    await assert.rejects(verifyReproducible(root, scratch, async (source, output) => {
      await buildPayload(source, output);
      if (builds++ === 1) {
        writeFileSync(join(output, ".hidden"), "different");
        const inventory: unknown = JSON.parse(readFileSync(join(source, "tools/payload-files.json"), "utf8"));
        writeFileSync(join(output, "SHA256SUMS"), payloadChecksums(output, inventory));
      }
    }), /payloads differ/);
    assert.deepEqual(readdirSync(scratch), ["keep.txt"]);
    assert.equal(readFileSync(join(scratch, "keep.txt"), "utf8"), "human file");
  });

  it("rejects input changes even when both generated outputs match", async () => {
    const root = fixture(), scratch = projectScratch("repro-owned-");
    roots.push(scratch);
    let builds = 0;
    await assert.rejects(verifyReproducible(root, scratch, async (source, output) => {
      await buildPayload(source, output);
      if (builds++ === 1) writeFileSync(join(source, "package-lock.json"), '{"changed":true}');
    }), /build inputs changed/);
    assert.deepEqual(readdirSync(scratch), []);
  });

  it("detects new source files added after the second build", async () => {
    const root = fixture(), scratch = projectScratch("repro-owned-");
    roots.push(scratch);
    let builds = 0;
    await assert.rejects(verifyReproducible(root, scratch, async (source, output) => {
      await buildPayload(source, output);
      if (builds++ === 1) writeFileSync(join(source, "plugin/new-file"), "new");
    }), /build inputs changed/);
    assert.deepEqual(readdirSync(scratch), []);
  });

  it("propagates either build failure and removes owned output directories", async () => {
    for (const failed of [0, 1]) {
      const root = fixture(), scratch = projectScratch("repro-owned-");
      roots.push(scratch);
      let builds = 0;
      await assert.rejects(verifyReproducible(root, scratch, async (_source, output) => {
        writeFileSync(join(output, "partial"), "not successful");
        if (builds++ === failed) throw new Error("synthetic build failure");
      }), /synthetic build failure/);
      assert.deepEqual(readdirSync(scratch), []);
    }
  });

  it("refuses unexpected or linked source payload files rather than filtering them from the copies", async () => {
    const root = fixture(), output = projectScratch("repro-output-");
    roots.push(output);
    writeFileSync(join(root, "plugin/unexpected"), "not allowed");
    await assert.rejects(buildPayload(root, output), /unexpected payload file/);
    rmSync(join(root, "plugin/unexpected"));
    rmSync(join(root, "plugin/.hidden"));
    symlinkSync(join(root, "NOTICE"), join(root, "plugin/.hidden"));
    await assert.rejects(buildPayload(root, output), /linked payload path/);
    assert.equal(existsSync(join(output, "SHA256SUMS")), false);
  });

  it("refuses a nonempty independent output directory without removing its contents", async () => {
    const root = fixture(), output = projectScratch("repro-output-");
    roots.push(output);
    writeFileSync(join(output, "keep.txt"), "human");
    await assert.rejects(buildPayload(root, output), /output directory must be empty/);
    assert.equal(readFileSync(join(output, "keep.txt"), "utf8"), "human");
  });

  it("refuses missing source files and output nested within the source payload", async () => {
    const root = fixture(), output = projectScratch("repro-output-");
    roots.push(output);
    rmSync(join(root, "plugin/.hidden"));
    await assert.rejects(buildPayload(root, output), /missing payload file: \.hidden/);
    await assert.rejects(buildPayload(root, join(root, "plugin/nested")), /outside the source payload/);
    assert.equal(existsSync(join(root, "plugin/nested")), false);
  });
});
