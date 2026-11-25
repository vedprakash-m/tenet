import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parse } from "yaml";
import { run } from "../../dist/cli.js";
import { fakeTty } from "../helpers/fakeTty.ts";
import { assertGolden, isolateScenarioGit } from "./scenario-support.ts";

test("scenario init uses the scratch Git owner and restores inherited config", async (t) => {
  const scratch = await mkdtemp(path.join(os.tmpdir(), "tenet-scenario-support-"));
  t.after(() => rm(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
  const repo = path.join(scratch, "repo");
  await mkdir(repo);
  execFileSync("git", ["init", "-q"], { cwd: repo });
  const inherited = process.env.GIT_CONFIG_GLOBAL;
  const inheritedConfig = process.env.GIT_CONFIG;
  const host = path.join(scratch, "host-gitconfig");
  await writeFile(host, "[user]\n\tname = Host Owner\n\temail = host@example.invalid\n");
  process.env.GIT_CONFIG_GLOBAL = host;
  process.env.GIT_CONFIG = host;
  try {
    const restore = await isolateScenarioGit(scratch);
    try {
      assert.equal(process.env.GIT_CONFIG_NOSYSTEM, "1");
      const email = execFileSync("git", ["config", "--get", "user.email"], { cwd: repo, encoding: "utf8" }).trim();
      assert.equal(email, "scenario@example.invalid");
      const tty = fakeTty("");
      assert.equal(await run(["--offline", "init", "--yes", "--json"], {
        ...tty, cwd: repo, checkEnvironment: false,
      }), 0, tty.stderr.text);
      const policy = parse(await readFile(path.join(repo, "tenet.yaml"), "utf8"));
      assert.deepEqual(policy.owners.map(({ id, name }) => ({ id, name })), [
        { id: "scenario-owner", name: "Scenario Owner" },
      ]);
    } finally {
      restore();
    }
    assert.equal(process.env.GIT_CONFIG_GLOBAL, host);
    assert.equal(process.env.GIT_CONFIG, host);
  } finally {
    if (inherited === undefined) delete process.env.GIT_CONFIG_GLOBAL;
    else process.env.GIT_CONFIG_GLOBAL = inherited;
    if (inheritedConfig === undefined) delete process.env.GIT_CONFIG;
    else process.env.GIT_CONFIG = inheritedConfig;
  }
});

test("scenario goldens count exact scalar tokens and preserve the surrounding shape", () => {
  const expected = { checks: [{ detail: "{{any:string}}", elapsed: "{{any:number}}" }], text: "prefix {{any:string}}" };
  const actual = { checks: [{ detail: "v24.0.0", elapsed: 2.5 }], text: "prefix {{any:string}}" };
  let uses = 0;
  const count = () => { uses += 1; };
  assertGolden(actual, expected, count);
  assert.equal(uses, 2);
  assert.throws(() => assertGolden({ checks: [{ elapsed: 2.5 }], text: actual.text }, expected, count), /\$\.checks\[0\]\.detail/);
  assert.equal(uses, 3);
  for (const invalid of [42, {}, [], null]) {
    assert.throws(() => assertGolden({ digest: invalid }, { digest: "{{any:string}}" }, count), /existing JSON string/);
  }
  for (const unsupported of ["{{any:object}}", "{{any:array}}"]) {
    assert.throws(() => assertGolden({ digest: {} }, { digest: unsupported }, count), /Unsupported golden placeholder/);
  }
  assert.throws(() => assertGolden({ ...actual, extra: true }, expected, count), /deep-equal/);
  assert.throws(() => assertGolden({ ...actual, text: "prefix changed" }, expected, count), /deep-equal/);
});
