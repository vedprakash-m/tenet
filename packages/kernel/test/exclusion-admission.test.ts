import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { allowed, matches } from "../src/core/exclusions.ts";
import { FsProject } from "../src/adapters/project-fs.ts";
import { cleanup, tmp, write } from "./helpers.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));

describe("conservative exclusion admission", () => {
  it("refuses default and configured case aliases before each capability [SEC-08, SEC-14]", () => {
    for (const path of [".ENV", "config/.Env.Local", "CERT.PEM", ".TENET/state",
      ".TENET-WRITE-12345678-1234-1234-1234-123456789abc.TMP"]) {
      for (const op of ["read", "scan", "model-send", "edit", "export"] as const)
        assert.equal(allowed(op, path, [], { kind: "routine-inventory" }), false, `${op}: ${path}`);
    }
    assert.equal(allowed("read", ".ENV.EXAMPLE", [], { kind: "routine-inventory" }), true);
    assert.equal(allowed("read", ".ENV.EXAMPLE", [{ pattern: ".env.example", kinds: ["no-read"] }],
      { kind: "routine-inventory" }), false);
    assert.equal(allowed("edit", "Private/FILE", [{ pattern: "private/**", kinds: ["no-edit"] }]), false);
    assert.equal(allowed("read", "public/file", [], { kind: "routine-inventory" }), true);
  });

  it("uses NFC and default Unicode folding rather than locale or RegExp flags [SEC-08, SEC-14]", () => {
    for (const [pattern, path] of [["Straße/**", "STRASSE/file"], ["café/**", "CAFE\u0301/file"],
      ["ΟΣ/**", "ος/file"], ["ﬃ/**", "FFI/file"], ["\u1c89/**", "\u1c8a/file"]]) {
      assert.equal(matches(pattern!, path!), true, `${pattern}: ${path}`);
      assert.equal(allowed("read", path!, [{ pattern: pattern!, kinds: ["no-read"] }], { kind: "routine-inventory" }), false);
    }
    assert.equal(matches("private/**", "other/file"), false);
    assert.equal(matches("İ/**", "i/file"), false, "default folding is not Turkic folding");
  });

  it("normalizes lexical paths but rejects invalid paths before policy matching [SEC-06]", () => {
    assert.equal(allowed("read", "./public/../.ENV", [], { kind: "routine-inventory" }), false);
    for (const path of ["../public", "/public", "C:\\public", "public\0file", ""]) {
      assert.throws(() => allowed("read", path), /path/i, path);
    }
    assert.equal(allowed("read", "public/./file", [], { kind: "routine-inventory" }), true);
  });

  it("keeps literal control characters distinct from glob syntax [SEC-08, SEC-14]", () => {
    for (const path of ["private\u0001file", "private\u0002file", "private\u0003file"]) {
      assert.equal(matches(path, path), true);
      assert.equal(allowed("read", path, [{ pattern: `${path}*`, kinds: ["no-read"] }], { kind: "routine-search" }), false);
      assert.equal(matches(path, "privatefile"), false);
    }
    assert.equal(allowed("read", ".env.example\n", [], { kind: "routine-search" }), false);
    assert.equal(matches("private/**", "private/line\nname"), true);
  });

  it("keeps local reads distinct from edit and destination restrictions [SEC-08]", () => {
    for (const kind of ["no-model-send", "no-export", "no-edit"] as const) {
      const rules = [{ pattern: "private/**", kinds: [kind] }];
      assert.equal(allowed("read", "PRIVATE/file", rules, { kind: "routine-inventory" }), true, kind);
      assert.equal(allowed(kind === "no-edit" ? "edit" : kind === "no-export" ? "export" : "model-send",
        "PRIVATE/file", rules, { kind: "routine-inventory" }), false, kind);
    }
    for (const op of ["read", "model-send", "scan"] as const)
      assert.equal(allowed(op, "ARCHIVE/file", [{ pattern: "archive/**", kinds: ["no-routine-scan"] }],
        { kind: "routine-inventory" }), false);
    assert.equal(allowed("read", "public/file"), false, "read use is required");
  });

  it("admits only a current exact-path explicit use of no-routine-scan [SEC-08, SEC-14]", () => {
    const binding = { path: "archive/file", policyHash: "policy", questionId: "question", factsHash: "facts" };
    const current = { policyHash: "policy", questionId: "question", factsHash: "facts" };
    const rules = [{ pattern: "archive/**", kinds: ["no-routine-scan" as const] }];
    const use = { kind: "explicit" as const, destination: "kernel" as const, binding };
    assert.equal(allowed("read", binding.path, rules, use, current), true);
    assert.equal(allowed("read", binding.path, rules, use), false);
    assert.equal(allowed("read", binding.path, rules, use, { ...current, factsHash: "later" }), false);
    assert.equal(allowed("read", "archive/other", rules, use, current), false);
    assert.equal(allowed("model-send", binding.path, rules, use, current), false);
    assert.equal(allowed("model-send", binding.path, rules, { ...use, destination: "model" }, current), true);
    for (const kind of ["no-read", "no-model-send"] as const) {
      const stricter = [...rules, { pattern: "archive/**", kinds: [kind] }];
      assert.equal(allowed("model-send", binding.path, stricter, { ...use, destination: "model" }, current), false);
      assert.equal(allowed("read", binding.path, stricter, use, current), kind !== "no-read");
    }
    for (const path of [".ENV", ".TENET/state"]) {
      assert.equal(allowed("read", path, [], { ...use, binding: { ...binding, path } }, current), false);
    }
  });

  it("revalidates explicit project reads against current policy and question facts [SEC-08, SEC-14]", () => {
    const root = tmp(); roots.push(root);
    write(root, "archive/file", "permitted exact input");
    const project = new FsProject(root);
    project.setExclusions([{ pattern: "archive/**", kinds: ["no-routine-scan"] }]);
    const binding = { path: "archive/file", policyHash: "policy", questionId: "question", factsHash: "facts" };
    const admission = { use: { kind: "explicit" as const, destination: "kernel" as const, binding },
      current: () => ({ policyHash: "policy", questionId: "question", factsHash: "facts" }) };
    assert.deepEqual(project.readBounded(binding.path, 64), { status: "unavailable", cause: "excluded" });
    assert.equal(project.read(binding.path, admission), "permitted exact input");
    assert.equal(project.readBounded(binding.path, 64, admission).status, "available");
    let observations = 0;
    const stale = { ...admission, current: () => ({ ...admission.current(), factsHash: ++observations < 2 ? "facts" : "later" }) };
    assert.deepEqual(project.readBounded(binding.path, 64, stale), { status: "unavailable", cause: "excluded" });
    project.setExclusions([{ pattern: "archive/**", kinds: ["no-read"] }]);
    assert.deepEqual(project.readBounded(binding.path, 64, admission), { status: "unavailable", cause: "excluded" });
  });

  it("refuses alias file reads, hashes and mutations without changing file bytes [SEC-06, SEC-14]", () => {
    const root = tmp(); roots.push(root);
    write(root, ".env", "synthetic restricted fixture");
    write(root, "private/file", "protected fixture");
    const project = new FsProject(root);
    project.setExclusions([{ pattern: "private/**", kinds: ["no-read", "no-edit"] }]);
    for (const path of [".ENV", "PRIVATE/file"]) {
      assert.throws(() => project.read(path), /policy|forbid/i);
      assert.throws(() => project.hashes([path]), /policy|forbid/i);
      assert.deepEqual(project.readBounded(path, 64), { status: "unavailable", cause: "excluded" });
      assert.throws(() => project.write(path, "replacement"), /policy|forbid/i);
      assert.throws(() => project.writeNew([{ path, content: "replacement", mode: 0o600 }]), /policy|forbid/i);
      assert.throws(() => project.remove([path]), /policy|forbid/i);
    }
    assert.equal(readFileSync(join(root, ".env"), "utf8"), "synthetic restricted fixture");
    assert.equal(readFileSync(join(root, "private/file"), "utf8"), "protected fixture");
    assert.deepEqual(readdirSync(root).sort(), [".env", "private"]);
  });

  it("observes zero file opens for prohibited aliases in a real process [SEC-08, SEC-14]", () => {
    const root = tmp(); roots.push(root);
    write(root, ".env", "synthetic restricted fixture");
    write(root, "private/file", "protected fixture");
    write(root, "public", "permitted fixture");
    const observed = JSON.parse(execFileSync(process.execPath,
      [join(import.meta.dirname, "fixtures/exclusion-file-opens.ts"), root], { encoding: "utf8" }));
    assert.deepEqual(observed, { refusedOpens: 0, allowedOpens: 1, allowed: "permitted fixture", unchanged: true });
  });
});
