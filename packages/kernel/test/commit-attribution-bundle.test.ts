import { after, it } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { cleanup, NO_POSIX_PROCESSES } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, callWithEnvelopeConsent, focusFixture, project } from "./support/fixture.ts";
import type { KernelResponse } from "../src/core/schemas.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const bundle = join(import.meta.dirname, "..", "..", "..", "plugin", "kernel", "tenet.mjs");
function bundledProject() {
  const p = project(); roots.push(p.root);
  const raw = async (verb: string, input: Record<string, unknown>): Promise<KernelResponse> => {
    const body = ["open", "decide", "findings"].includes(verb);
    const args = body ? [] : Object.entries(input).flatMap(([key, value]) => [
      `--${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`,
      Array.isArray(value) ? value.join(",") : typeof value === "object" ? JSON.stringify(value) : String(value),
    ]);
    const child = spawnSync(process.execPath, [bundle, verb, ...args], {
      cwd: p.root, encoding: "utf8", input: body ? JSON.stringify(input) : "",
      env: {
        PATH: process.env.PATH, HOME: process.env.HOME, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1",
        ...(process.env.GITHUB_ACTIONS === undefined ? {} : { GITHUB_ACTIONS: process.env.GITHUB_ACTIONS }),
        ...(process.env.GITHUB_WORKSPACE === undefined ? {} : { GITHUB_WORKSPACE: process.env.GITHUB_WORKSPACE }),
      },
    });
    assert.ifError(child.error);
    assert.equal(child.signal, null, child.stderr);
    assert.ok(child.stdout.trim(), child.stderr);
    const response = JSON.parse(child.stdout) as KernelResponse;
    assert.equal(child.status, response.exit, child.stderr);
    return response;
  };
  p.call = (verb, input = {}) => callWithEnvelopeConsent(raw, verb, input);
  return p;
}
async function ready() {
  const p = bundledProject();
  const h = (await p.call("open", { profile: "feature", request: "bundle attribution", lane: "quick" })).handle!;
  await p.call("decide", { h, kind: "basis", propose: BASIS });
  p.write("src/greet.test.ts", GREET_TEST); await p.call("check", { h, stage: "baseline" });
  p.write("src/greet.ts", GREET_IMPL);
  const checked = await p.call("check", { h, touched: ["src/greet.ts"] });
  assert.equal(checked.exit, 0, JSON.stringify(checked));
  await focusFixture(p, h);
  return { p, h };
}
it("built CLI publishes the durable proof/result pair on a real scratch repository [GIT-03]",
  { skip: NO_POSIX_PROCESSES }, async () => {
    const { p, h } = await ready();
    const committed = await p.call("commit", { h, subject: "Bundle proof" });
    assert.equal(committed.exit, 0, JSON.stringify(committed));
    const directory = join(p.root, ".tenet", "git", "commit-proofs-v1");
    const names = readdirSync(directory);
    assert.equal(names.length, 1);
    const proof = JSON.parse(readFileSync(join(directory, names[0]!), "utf8"));
    assert.equal(proof.commit, p.git("rev-parse", "HEAD"));
    assert.deepEqual(proof.foreign, []);
    assert.equal(p.ports().store.commitProofs()[0]!.commit, proof.commit);
  });
it("built CLI keeps an interrupted commit unowned and leaves it unrecorded without changing Git [CON-12]",
  { skip: NO_POSIX_PROCESSES }, async () => {
    const { p, h } = await ready();
    const child = spawn(process.execPath, [join(import.meta.dirname, "fixtures", "crash-commit.ts"),
      p.root, "commit", JSON.stringify({ h, subject: "Interrupted bundle input" }), "after-act"], { stdio: "ignore" });
    assert.equal(await new Promise(resolve => child.on("exit", (_code, signal) => resolve(signal))), "SIGKILL");
    const head = p.git("rev-parse", "HEAD"), index = readFileSync(join(p.root, ".git", "index"));
    const fenced = await p.call("commit", { h, subject: "Must not repeat" });
    assert.equal(fenced.exit, 2, JSON.stringify(fenced));
    const q = fenced.questions![0]!;
    const cleared = await p.call("decide", {
      h, kind: "leave-unrecorded", target: q.id.slice("leave-unrecorded-".length), answers: { [q.id]: "leave-unrecorded" },
    });
    assert.equal(cleared.exit, 0, JSON.stringify(cleared));
    assert.equal(p.git("rev-parse", "HEAD"), head);
    assert.deepEqual(readFileSync(join(p.root, ".git", "index")), index);
    assert.deepEqual(Object.values(p.ports().store.read()!.state.work)[0]!.git.commits, []);
    assert.deepEqual(p.ports().store.commitProofs(), []);
  });
