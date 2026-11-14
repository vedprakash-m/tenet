// NFR-01: the repository probe and inventory that every `open` runs start no Git process they do not need.
// Counted with Git's own trace2 events; the results themselves are covered by the adapter's behavior tests.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { GitCli } from "../src/adapters/git-cli.ts";
import { cleanup, git, initRepo, tmp, write } from "./helpers.ts";

const dirs: string[] = [];
after(() => dirs.forEach(cleanup));

async function traced(fn: () => Promise<unknown>): Promise<string[]> {
  const trace = join(tmp("tenet-trace-"), "events.json");
  dirs.push(join(trace, ".."));
  process.env.GIT_TRACE2_EVENT = trace;
  try { await fn(); } finally { delete process.env.GIT_TRACE2_EVENT; }
  let text = "";
  try { text = readFileSync(trace, "utf8"); } catch { return []; }
  return text.split("\n").filter(Boolean).map((l) => JSON.parse(l) as { event: string; sid: string; argv?: string[] })
    .filter((e) => e.event === "start" && !e.sid.includes("/")).map((e) => (e.argv ?? []).slice(1).join(" "));
}

describe("Git processes per call", () => {
  it("reads the object format once per adapter, however often the inventory runs", async () => {
    const root = tmp("tenet-gpc-"); dirs.push(root);
    initRepo(root);
    write(root, "src/a.ts", "export const a = 1;\n");
    git(root, "add", "-A"); git(root, "commit", "-qm", "a");
    const cli = new GitCli(root);
    const started = await traced(async () => { await cli.inventory([]); await cli.inventory([]); });
    assert.ok(started.length > 0, "trace2 recorded no Git process");
    assert.equal(started.filter((a) => a.includes("--show-object-format")).length, 1, started.join("\n"));
  });

  it("starts the three index listings before status, which needs their results", async () => {
    const root = tmp("tenet-gpc-"); dirs.push(root);
    initRepo(root);
    write(root, "src/a.ts", "export const a = 1;\n");
    git(root, "add", "-A"); git(root, "commit", "-qm", "a");
    const started = await traced(() => new GitCli(root).inventory([]));
    const at = (needle: string) => started.findIndex((a) => a.includes(needle));
    const status = at(" status --porcelain=v2");
    assert.ok(status > 0, started.join("\n"));
    for (const listing of ["ls-files -s -z", "ls-files --others", "ls-files -v -z"]) {
      assert.ok(at(listing) >= 0 && at(listing) < status, listing);
    }
  });
});
