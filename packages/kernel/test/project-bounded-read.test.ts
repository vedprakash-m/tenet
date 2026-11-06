import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FsProject } from "../src/adapters/project-fs.ts";
import { cleanup, tmp, write } from "./helpers.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const fresh = () => { const root = tmp(); roots.push(root); return { root, project: new FsProject(root) }; };
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

describe("bounded presentation-source read foundation", () => {
  it("admits exact UTF-8 byte limits and hashes original stable bytes", () => {
    const { root, project } = fresh();
    write(root, "README.md", "é".repeat(4));
    assert.deepEqual(project.readBounded("README.md", 8), { status: "available", text: "é".repeat(4), sha256: sha256("é".repeat(4)) });
    assert.deepEqual(project.readBounded("README.md", 7), { status: "unavailable", cause: "too-large" });
    assert.equal(project.read("README.md"), "é".repeat(4), "the smaller bound does not replace the legacy read limit");
    write(root, "empty", "");
    assert.deepEqual(project.readBounded("empty", 1), { status: "available", text: "", sha256: sha256("") });
  });
  it("distinguishes absence, exclusions, links, non-files and outside paths without returning content", () => {
    const { root, project } = fresh();
    write(root, "private/file", "preserve private bytes");
    project.setExclusions([{ pattern: "private", kinds: ["no-read"] }]);
    symlinkSync("private/file", join(root, "alias"));
    symlinkSync("private", join(root, "linked-parent"));
    symlinkSync("missing", join(root, "dangling"));
    mkdirSync(join(root, "directory"));
    for (const [path, cause] of [["missing", "missing"], ["private/file", "excluded"], ["alias", "linked"],
      ["linked-parent/file", "linked"], ["dangling", "linked"], ["directory", "not-regular"], ["../outside", "outside"]]) {
      assert.deepEqual(project.readBounded(path!, 64), { status: "unavailable", cause }, path);
    }
    assert.throws(() => project.read("private/file"), /policy|forbid/i, "legacy refusals still throw");
  });
  it("refuses invalid encoding on both text paths while preserving literal replacement characters", () => {
    const { root, project } = fresh();
    writeFileSync(join(root, "invalid"), Buffer.from([0xc3, 0x28]));
    assert.deepEqual(project.readBounded("invalid", 64), { status: "unavailable", cause: "invalid-utf8" });
    assert.throws(() => project.read("invalid"), /UTF-8/i);
    write(root, "replacement", "�");
    assert.equal(project.read("replacement"), "�");
    assert.deepEqual(project.readBounded("replacement", 3), { status: "available", text: "�", sha256: sha256("�") });
  });
  it("keeps invalid trusted bounds as programming errors", () => {
    const { project } = fresh();
    for (const limit of [0, -1, 0.5, Infinity, NaN, 21 * 1024 * 1024]) assert.throws(() => project.readBounded("missing", limit), RangeError);
  });
  for (const mode of ["grow", "oversized", "shrink", "overwrite"]) it(`withholds bytes changed during admission: ${mode}`, () => {
    const { root } = fresh(); write(root, "input", "original bytes\n");
    const result = JSON.parse(execFileSync(process.execPath, [join(import.meta.dirname, "fixtures/race-project-read.ts"), root, mode, "bounded"], { encoding: "utf8" }));
    assert.deepEqual(result.value, { status: "unavailable", cause: "moved" });
  });
  for (const [mode, cause] of [["replace-fifo", "not-regular"], ["replace-directory", "not-regular"], ["replace-link", "linked"], ["unreadable", "unreadable"]]) {
    it(`refuses admission-time substitutions or read failures: ${mode}`, { timeout: 5000 }, () => {
      const { root } = fresh(); write(root, "input", "original bytes\n");
      const result = JSON.parse(execFileSync(process.execPath, [join(import.meta.dirname, "fixtures/race-project-read.ts"), root, mode!, "bounded"], { encoding: "utf8", timeout: 3000 }));
      assert.deepEqual(result.value, { status: "unavailable", cause });
    });
  }
  it("does not turn an unexpected implementation failure into source absence", () => {
    const { root } = fresh(); write(root, "input", "original bytes\n");
    const result = JSON.parse(execFileSync(process.execPath, [join(import.meta.dirname, "fixtures/race-project-read.ts"), root, "unexpected", "bounded"], { encoding: "utf8" }));
    assert.equal(result.value, undefined);
    assert.equal(result.message, "injected programmer failure");
  });
  it("loops short reads and never allocates beyond an exact caller limit", () => {
    const { root } = fresh(); const content = "é".repeat(32); write(root, "input", content);
    const result = JSON.parse(execFileSync(process.execPath, [join(import.meta.dirname, "fixtures/race-project-read.ts"), root, "short", "bounded"], { encoding: "utf8" }));
    assert.deepEqual(result.value, { status: "available", text: content, sha256: sha256(content) });
    assert.ok(result.allocationBytes.length > 0);
    assert.ok(result.allocationBytes.every((bytes: number) => bytes <= 64));
  });
});
