// Git processes per call matter for call latency (NFR-01): a read the adapter already made is not made again.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { GitCli } from "../src/adapters/git-cli.ts";
import { locate } from "../src/adapters/git-layout.ts";
import { cleanup, git, initRepo, tmp, write } from "./helpers.ts";

const dirs: string[] = [];
after(() => dirs.forEach(cleanup));

/** The argument lists of the Git processes `fn` starts, read from Git's own trace2 event stream. */
async function gitCalls(fn: () => Promise<unknown>): Promise<string[]> {
  const trace = join(tmp(), "trace2.json"), before = process.env.GIT_TRACE2_EVENT;
  process.env.GIT_TRACE2_EVENT = trace;
  try { await fn(); } finally { if (before === undefined) delete process.env.GIT_TRACE2_EVENT; else process.env.GIT_TRACE2_EVENT = before; }
  return readFileSync(trace, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as { event: string; sid: string; argv?: string[] })
    .filter((e) => e.event === "start" && !e.sid.includes("/")).map((e) => (e.argv ?? []).slice(1).join(" "));
}

describe("git rounds", () => {
  it("reads the filter configuration once for an inventory and the filter gate", async () => {
    const root = tmp();
    dirs.push(root);
    initRepo(root);
    write(root, "src/a.ts", "export const a = 1;\n");
    git(root, "add", "-A");
    git(root, "commit", "-qm", "init");
    const g = new GitCli(root);
    const calls = await gitCalls(async () => { await g.inventory([]); await g.filterGate(); });
    assert.equal(calls.filter((c) => c.includes("--get-regexp ^filter\\.")).length, 1, calls.join("\n"));
  });

  it("reads the repository's locations and shallowness in one rev-parse", async () => {
    const root = tmp();
    dirs.push(root);
    initRepo(root);
    let probe;
    const calls = await gitCalls(async () => { probe = await new GitCli(root).probe(); });
    const revParse = calls.filter((c) => / rev-parse (?!--verify)/.test(` ${c}`));
    assert.equal(revParse.length, 1, revParse.join("\n"));
    assert.deepEqual([resolve(probe!.top!), probe!.layout.shallow, probe!.layout.linkedWorktree], [resolve(root), false, false]);
  });

  it("reads each location on its own when the combined rev-parse fails or does not give one line per value", async () => {
    const answers: Record<string, string | null> = {
      "rev-parse --show-toplevel": "/r\nx", "rev-parse --absolute-git-dir": "/r\nx/.git",
      "rev-parse --path-format=absolute --git-common-dir": null, "rev-parse --is-shallow-repository": "true",
    };
    const asked: string[] = [];
    const tryOut = async (args: string[]) => { asked.push(args.join(" ")); return args.length > 3 ? "/r\nx\n/r\nx/.git\n/r\nx/.git\ntrue" : answers[args.join(" ")] ?? null; };
    assert.deepEqual(await locate(tryOut), { top: "/r\nx", gitDir: "/r\nx/.git", common: null, shallow: true });
    assert.equal(asked.length, 5);
    assert.equal(await locate(async () => null), null);
  });
});
