import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, symlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { FsProject } from "../src/adapters/project-fs.ts";
import { cleanup, tmp, write } from "./helpers.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const fresh = () => { const root = tmp(); roots.push(root); return { root, p: new FsProject(root) }; };

describe("project filesystem boundaries [SEC-06, SEC-14, CON-03]", () => {
  it("does not follow the predictable temporary-file link when replacing an accepted-fact file", () => {
    const { root, p } = fresh(), outside = fresh().root;
    write(outside, "private", "preserve outside bytes");
    const trap = join(root, `INTENT.md.tenet-${process.pid}.tmp`);
    symlinkSync(join(outside, "private"), trap);
    p.write("INTENT.md", "accepted intent\n");
    assert.equal(readFileSync(join(outside, "private"), "utf8"), "preserve outside bytes");
    assert.equal(readFileSync(join(root, "INTENT.md"), "utf8"), "accepted intent\n");
    assert.equal(lstatSync(trap).isSymbolicLink(), true, "an unowned trap is left untouched");
  });
  it("never reads a secret through a benign in-workspace alias", () => {
    const { root, p } = fresh(); write(root, ".env", "UNTRUSTED_SECRET_CANARY");
    symlinkSync(".env", join(root, "INTENT.md"));
    assert.throws(() => p.read("INTENT.md"), /link/i);
    assert.throws(() => p.hashes(["INTENT.md"]), /link/i);
  });
  it("does not publish or remove a temporary file replaced by another process", () => {
    const { root } = fresh(); write(root, "README.md", "prior accepted text");
    const result = execFileSync(process.execPath, [join(import.meta.dirname, "fixtures/race-project-write.ts"), root], { encoding: "utf8" });
    assert.match(result, /capability-missing/);
    assert.equal(readFileSync(join(root, "README.md"), "utf8"), "prior accepted text");
    const temporary = readdirSync(root).find(path => path.startsWith(".tenet-write-") && path.endsWith(".tmp"))!;
    assert.equal(readFileSync(join(root, temporary), "utf8"), "foreign temporary file");
  });
  for (const operation of ["read", "hash", "write", "new", "remove"]) it(`refuses parent-link alias during ${operation}`, () => {
    const { root, p } = fresh(); write(root, "private/file", "preserve protected bytes");
    symlinkSync("private", join(root, "public"));
    p.setExclusions([{ pattern: "private", kinds: ["no-read", "no-edit"] }]);
    const act = () => {
      if (operation === "read") p.read("public/file");
      if (operation === "hash") p.hashes(["public/file"]);
      if (operation === "write") p.write("public/file", "bad");
      if (operation === "new") p.writeNew([{ path: "public/new", content: "bad", mode: 0o644 }]);
      if (operation === "remove") p.remove(["public/file"]);
    };
    assert.throws(act, /link/i);
    assert.equal(readFileSync(join(root, "private/file"), "utf8"), "preserve protected bytes");
    assert.equal(existsSync(join(root, "private/new")), false);
  });
  it("refuses a dangling leaf link instead of treating it as an absent shared file", () => {
    const { root, p } = fresh(); symlinkSync("missing", join(root, "INTENT.md"));
    assert.throws(() => p.read("INTENT.md"), /link/i);
    assert.throws(() => p.hashes(["INTENT.md"]), /link/i);
    assert.throws(() => p.write("INTENT.md", "bad"), /link/i);
  });
  it("distinguishes excluded and non-file inputs from absence", () => {
    const { root, p } = fresh(); write(root, "private/file", "preserve");
    p.setExclusions([{ pattern: "private", kinds: ["no-read", "no-edit"] }]);
    assert.throws(() => p.read("private/file"), /policy|forbid/i);
    assert.throws(() => p.hashes(["private/file"]), /policy|forbid/i);
    mkdirSync(join(root, "INTENT.md"));
    assert.throws(() => p.read("INTENT.md"), /regular|file|director/i);
    assert.throws(() => p.hashes(["INTENT.md"]), /regular|file|director/i);
  });
  it("checks exclusions after normalizing an in-workspace path", () => {
    const { root, p } = fresh(); write(root, "private/file", "preserve"); mkdirSync(join(root, "public"));
    p.setExclusions([{ pattern: "private", kinds: ["no-read", "no-edit"] }]);
    assert.throws(() => p.write("public/../private/file", "bad"), /policy|forbid/i);
    assert.equal(readFileSync(join(root, "private/file"), "utf8"), "preserve");
  });
  it("keeps missing files distinct and supports ordinary nested writes", () => {
    const { root, p } = fresh();
    assert.equal(p.read("new/file"), null); assert.deepEqual(p.hashes(["new/file"]), { "new/file": null });
    p.write("new/file", "first"); p.write("new/file", "second");
    assert.equal(p.read("new/file"), "second");
    p.writeNew([{ path: "new/other", content: "new", mode: 0o644 }]);
    assert.throws(() => p.writeNew([{ path: "new/other", content: "overwrite", mode: 0o644 }]));
    assert.equal(p.read("new/other"), "new");
    p.remove(["new/other"]); assert.equal(existsSync(join(root, "new/other")), false);
  });
  it("keeps accepted-file permissions private and honors recipe executable modes", () => {
    const { root, p } = fresh(); write(root, "INTENT.md", "prior"); chmodSync(join(root, "INTENT.md"), 0o600);
    p.write("INTENT.md", "new"); assert.equal(lstatSync(join(root, "INTENT.md")).mode & 0o777, 0o600);
    p.write("new.md", "new"); assert.equal(lstatSync(join(root, "new.md")).mode & 0o777, 0o600);
    p.writeNew([{ path: "script", content: "#!/bin/sh\n", mode: 0o755 }]);
    assert.equal(lstatSync(join(root, "script")).mode & 0o777, 0o755);
  });
  it("refuses to read a project file past the bounded size, rather than loading it unbounded [CON-03]", () => {
    const { root, p } = fresh();
    write(root, "package-lock.json", "x".repeat(21 * 1024 * 1024));
    assert.throws(() => p.read("package-lock.json"), /project-file-too-large|exceeds/i);
    assert.throws(() => p.hashes(["package-lock.json"]), /project-file-too-large|exceeds/i);
  });
  for (const mode of ["grow", "oversized", "shrink", "overwrite"]) {
    for (const operation of ["read", "hash"]) it(`refuses ${operation} when another process changes the admitted file: ${mode} [CON-03, SEC-06]`, () => {
      const { root } = fresh(); write(root, "input", "original bytes\n");
      const result = JSON.parse(execFileSync(process.execPath, [join(import.meta.dirname, "fixtures/race-project-read.ts"), root, mode, operation], { encoding: "utf8" }));
      assert.ok(["capability-missing", "project-file-too-large"].includes(result.code), JSON.stringify(result));
      assert.equal(result.value, undefined, "neither text nor a hash proves a file that changed during admission");
    });
  }
  for (const operation of ["read", "hash"]) it(`handles short operating-system reads without truncating ${operation} [CON-03]`, () => {
    const { root } = fresh(), content = "original bytes\n"; write(root, "input", content);
    const result = JSON.parse(execFileSync(process.execPath, [join(import.meta.dirname, "fixtures/race-project-read.ts"), root, "short", operation], { encoding: "utf8" }));
    assert.deepEqual(result, { value: operation === "hash" ? createHash("sha256").update(content).digest("hex") : content.length });
  });
});
