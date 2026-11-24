import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";
import { git } from "../../dist/core/git.js";
import { makeOnboardCommand } from "../../dist/commands/onboard.js";
import { onboard, type OnboardOptions } from "../../dist/onboard/assignment.js";
import { validate } from "../../dist/core/schema.js";
import { tmpRepo } from "../helpers/tmpRepo.ts";

type File = string | { $synthetic: "repeat"; line: string; count: number };
type Fixture = {
  operation: "onboard";
  options: Omit<OnboardOptions, "cwd">;
  repo: {
    revision: string | null;
    files: Record<string, File>;
    worktreeOnly?: Record<string, File>;
    committedDates?: Record<string, string>;
  };
};

function bytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function fileContents(file: File): string {
  if (typeof file === "string") return file;
  assert.equal(file.$synthetic, "repeat");
  return file.line.repeat(file.count);
}

async function materialize(t: TestContext, input: Fixture["repo"]) {
  const repo = await tmpRepo("alg-11");
  t.after(repo.cleanup);
  const defaultDate = "2025-01-01T00:00:00Z";
  const dates = new Map<string, string[]>();
  for (const file of Object.keys(input.files)) {
    const date = input.committedDates?.[file] ?? defaultDate;
    const list = dates.get(date) ?? [];
    list.push(file);
    dates.set(date, list);
  }
  for (const [date, files] of [...dates].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)) {
    for (const file of files) {
      const value = input.files[file];
      assert.ok(value !== undefined);
      await repo.write(file, fileContents(value));
    }
    if (input.revision !== null) {
      repo.git(["add", "-A", "-f", "--", "."]);
      await git(["commit", "--quiet", "--no-verify", "-m", "fixture"], {
        cwd: repo.path, env: { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
      });
    }
  }
  for (const [file, content] of Object.entries(input.worktreeOnly ?? {})) {
    await repo.write(file, fileContents(content));
  }
  return repo;
}

const suite = new URL("../../pkg/conformance/alg-11/", import.meta.url);
const directories = (await readdir(suite, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map(({ name }) => name).sort();
assert.equal(directories.length, 13);
for (const name of directories) {
  test(`independent ALG-11 ${name} matches exact bytes`, async (t) => {
    const folder = new URL(`${name}/`, suite);
    const input: Fixture = JSON.parse(await readFile(new URL("input.json", folder), "utf8"));
    const expected = await readFile(new URL("expected.json", folder));
    assert.equal(input.operation, "onboard");
    const repo = await materialize(t, input.repo);
    if (input.repo.revision === null) {
      const { handler } = makeOnboardCommand({});
      const output = await handler({ cwd: repo.path, args: [], options: { "--inventory-only": true }, json: true });
      const { exitCodeFor } = await import("../../dist/core/output.js");
      const errors = output.findings.map(({ code, message, fix }) => ({ code, message, fix }));
      assert.deepEqual(bytes({ ok: false, exitCode: exitCodeFor(output.findings), errors }), expected);
      return;
    }

    const result = await onboard({ cwd: repo.path, ...input.options });
    const head = repo.git(["rev-parse", "HEAD"]).trim();
    assert.equal(result.preflight.revision, head);
    assert.equal(result.inventory.revision, head);
    assert.deepEqual(validate("inventory", result.inventory), { ok: true, errors: [] });
    assert.deepEqual(validate("assignment", result.assignment), { ok: true, errors: [] });
    assert.deepEqual(await readFile(path.join(repo.path, ".tenet/onboard/inventory.json")), bytes(result.inventory));
    assert.deepEqual(await readFile(path.join(repo.path, ".tenet/onboard/assignment.json")), bytes(result.assignment));

    // Fixture IDs name snapshots, not actual Git objects. Rebind only the two
    // public revision fields after checking that both resolve to real HEAD.
    const rebound = {
      ...result,
      preflight: { ...result.preflight, revision: input.repo.revision },
      inventory: { ...result.inventory, revision: input.repo.revision },
    };
    assert.deepEqual(bytes({ ok: true, exitCode: 0, ...rebound }), expected);
  });
}
