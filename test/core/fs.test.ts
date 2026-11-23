import assert from "node:assert/strict";
import { readFile, readdir, symlink } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { confine, writeAtomic } from "../../dist/core/fs.js";
import { tmpRepo } from "../helpers/tmpRepo.ts";

test("writeAtomic writes in place and leaves no temporary file", async () => {
  const repository = await tmpRepo("atomic");
  try {
    const filename = path.join(repository.path, "nested", "state.json");
    await writeAtomic(filename, '{"old":true}');
    await writeAtomic(filename, '{"new":true}');
    assert.equal(await readFile(filename, "utf8"), '{"new":true}');
    assert.deepEqual(await readdir(path.dirname(filename)), ["state.json"]);
  } finally {
    await repository.cleanup();
  }
});

test("writeAtomic retains the old file when writing is interrupted", async () => {
  const repository = await tmpRepo("interrupted");
  try {
    const filename = path.join(repository.path, "state.txt");
    await writeAtomic(filename, "old");
    await assert.rejects(writeAtomic(filename, null as unknown as Uint8Array));
    assert.equal(await readFile(filename, "utf8"), "old");
    assert.deepEqual(await readdir(repository.path), [".git", "state.txt"]);
  } finally {
    await repository.cleanup();
  }
});

test("writeAtomic makes the initial rename and at most five retries", async () => {
  const repository = await tmpRepo("atomic-retries");
  try {
    const filename = path.join(repository.path, "state.txt");
    await writeAtomic(filename, "old");
    const expected = Object.assign(new Error("retry"), { code: "EBUSY" });
    let attempts = 0;
    await assert.rejects(
      writeAtomic(filename, "new", {
        async renameFile() {
          attempts += 1;
          throw expected;
        },
        async retryDelay() {},
      }),
      expected,
    );
    assert.equal(attempts, 6);
    assert.equal(await readFile(filename, "utf8"), "old");
  } finally {
    await repository.cleanup();
  }
});

test("confine normalizes separators and rejects escape forms", async () => {
  const repository = await tmpRepo("confine");
  try {
    const resolved = await confine("folder\\café file.txt", repository.path);
    assert.equal(resolved, path.join(repository.path, "folder", "café file.txt").replaceAll("\\", "/"));
    await assert.rejects(confine("../outside", repository.path), { code: "TN-PATH-ESCAPE" });
    await assert.rejects(confine("/absolute", repository.path), { code: "TN-PATH-ESCAPE" });
    await assert.rejects(confine("C:\\absolute", repository.path), { code: "TN-PATH-ESCAPE" });
  } finally {
    await repository.cleanup();
  }
});

test("confine rejects a symlink or junction leading outside", async () => {
  const repository = await tmpRepo("symlink-inside");
  const external = await tmpRepo("symlink-outside");
  try {
    const link = path.join(repository.path, "external");
    await symlink(external.path, link, process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(confine("external/file.txt", repository.path), { code: "TN-PATH-ESCAPE" });
  } finally {
    await repository.cleanup();
    await external.cleanup();
  }
});
