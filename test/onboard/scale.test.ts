import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { Envelope } from "../../dist/core/output.js";
import type { OnboardResult } from "../../dist/onboard/assignment.js";
import { tmpRepo, type TemporaryRepository } from "../helpers/tmpRepo.ts";

const cli = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));

function commit(repo: TemporaryRepository, date: string) {
  repo.git(["add", "-A"]);
  const result = spawnSync("git", ["commit", "-qm", "Documentation"], {
    cwd: repo.path,
    env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
    encoding: "utf8",
    windowsHide: true,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
}

test("onboard inventories documents whose paths exceed the Windows Git argument limit", async (t) => {
  const repo = await tmpRepo("onboard-large");
  t.after(repo.cleanup);
  const paths = Array.from({ length: 360 }, (_, i) =>
    `docs/${"section-".repeat(13)}/page ${String(i).padStart(4, "0")} [v1].md`);
  assert.ok(paths.join(" ").length > 32_767);
  const firstDate = "2026-11-23T10:00:00Z";
  const secondDate = "2026-11-23T11:00:00Z";
  for (const file of paths) await repo.write(file, "# Documentation\n");
  commit(repo, firstDate);
  const changed = paths[0];
  assert.ok(changed);
  await repo.write(changed, "# Revised documentation\n");
  commit(repo, secondDate);

  const child = spawnSync(process.execPath, [cli, "onboard", "--inventory-only", "--json"], {
    cwd: repo.path, encoding: "utf8", windowsHide: true, maxBuffer: 8 * 1024 * 1024,
  });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stdout || child.stderr);
  const envelope: Envelope<OnboardResult> = JSON.parse(child.stdout);
  assert.equal(envelope.ok, true);
  assert.deepEqual(envelope.errors, []);
  const docs = envelope.result.inventory.docs;
  assert.deepEqual(docs.map(({ path }) => path), paths);
  assert.equal(docs[0]?.last_changed, secondDate);
  assert.ok(docs.slice(1).every(({ last_changed }) => last_changed === firstDate));
});
