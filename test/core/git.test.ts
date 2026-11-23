import assert from "node:assert/strict";
import test from "node:test";
import { catFileBatch, git, lastChangedMap, writeRefFiles } from "../../dist/core/git.js";
import { tmpRepo } from "../helpers/tmpRepo.ts";

test("git preserves spaces and non-ASCII names with quotient disabled", async () => {
  const repository = await tmpRepo("git-paths");
  try {
    await repository.write("folder/with spaces/日本語.txt", "héllo");
    const listed = await git(["ls-files", "--others", "--exclude-standard"], { cwd: repository.path });
    assert.match(listed, /folder\/with spaces\/日本語\.txt/);
  } finally {
    await repository.cleanup();
  }
});

test("catFileBatch reads 1,500 blobs in one process and maps all paths", async () => {
  const repository = await tmpRepo("git-batch");
  try {
    const paths: string[] = [];
    for (let index = 0; index < 1_500; index += 1) {
      const filename = `files/${String(index).padStart(4, "0")} file.txt`;
      paths.push(filename);
      await repository.write(filename, `value ${index}`);
    }
    repository.git(["add", "."]);
    repository.git(["commit", "--quiet", "-m", "add blobs"]);
    const blobs = await catFileBatch("HEAD", paths, { cwd: repository.path });
    assert.equal(blobs.size, 1_500);
    assert.equal(blobs.get(paths[0] ?? "")?.toString("utf8"), "value 0");
    assert.equal(blobs.get(paths[1_499] ?? "")?.toString("utf8"), "value 1499");
  } finally {
    await repository.cleanup();
  }
});

test("lastChangedMap resolves paths from batched history", async () => {
  const repository = await tmpRepo("git-changed");
  try {
    await repository.write("one.txt", "one");
    await repository.write("two files/β.txt", "two");
    repository.git(["add", "."]);
    repository.git(["commit", "--quiet", "-m", "first"]);
    const first = repository.git(["rev-parse", "HEAD"]).trim();
    await repository.write("one.txt", "changed");
    repository.git(["add", "."]);
    repository.git(["commit", "--quiet", "-m", "second"]);
    const second = repository.git(["rev-parse", "HEAD"]).trim();
    const changed = await lastChangedMap(["one.txt", "two files/β.txt"], { cwd: repository.path });
    assert.equal(changed.get("one.txt"), second);
    assert.equal(changed.get("two files/β.txt"), first);
  } finally {
    await repository.cleanup();
  }
});

test("writeRefFiles writes plumbing-only commits without changing the worktree", async () => {
  const repository = await tmpRepo("git-ref");
  try {
    await repository.write("tracked.txt", "before");
    repository.git(["add", "."]);
    repository.git(["commit", "--quiet", "-m", "base"]);
    const ref = "refs/tenet/test";
    const first = await writeRefFiles(ref, { "folder/space name.txt": "new contents" }, "first ref", {
      cwd: repository.path,
      now: new Date("2026-11-23T00:00:00.000Z"),
    });
    assert.equal(repository.git(["rev-parse", ref]).trim(), first);
    const blob = await catFileBatch(ref, ["folder/space name.txt", "tracked.txt"], { cwd: repository.path });
    assert.equal(blob.get("folder/space name.txt")?.toString("utf8"), "new contents");
    assert.equal(blob.get("tracked.txt")?.toString("utf8"), "before");
    assert.equal(repository.git(["status", "--porcelain"]), "");
  } finally {
    await repository.cleanup();
  }
});
