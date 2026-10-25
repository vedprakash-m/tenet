// Native-host tests through the Copilot CLI (SP-11 feasibility, TS §19). The harness itself is tested against a fake binary
// on every run. Live cases run only with TENET_HOST=cli and a run budget in TENET_HOST_RUNS, and decide from what the
// kernel wrote in `.tenet`, never from what the model reports.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { argvFor, reserveRun, runCopilot, summarize } from "../../../tools/host/copilot-cli.ts";
import { git } from "./helpers.ts";

const dirs: string[] = [];
after(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });
const scratch = () => { const d = mkdtempSync(join(tmpdir(), "tenet-host-")); dirs.push(d); return d; };
const fake = (body: string) => { const f = join(scratch(), "copilot"); writeFileSync(f, `#!/bin/sh\n${body}\n`); chmodSync(f, 0o755); return f; };

describe("host harness (offline, against a fake copilot) [ENG-04]", () => {
  it("records the tuple, the arguments without the prompt, the exit, timing and the raw transcript", async () => {
    const out = scratch();
    const obs = await runCopilot({ id: "fake-1", prompt: "SECRET PROMPT", cwd: scratch(), pluginDir: "/p", timeoutMs: 10_000 }, { bin: fake('echo "{\\"type\\":\\"hello\\"}"; case "$1" in --version) echo 1.2.3;; esac'), outDir: out });
    assert.equal(obs.exit, 0);
    assert.ok(!JSON.stringify(obs.argv).includes("SECRET PROMPT") && obs.argv.includes("<prompt>"));
    assert.ok(obs.argv.includes("--plugin-dir") && obs.argv.includes("--allow-all-tools"));
    assert.match(readFileSync(obs.transcript, "utf8"), /hello/);
    assert.equal(JSON.parse(readFileSync(join(out, "fake-1", "observation.json"), "utf8")).tuple.copilot.length > 0, true);
  });

  it("kills a run that exceeds its time and says so", async () => {
    const obs = await runCopilot({ id: "slow", prompt: "x", cwd: scratch(), timeoutMs: 300 }, { bin: fake('[ "$1" = --version ] && exit 0; sleep 5'), outDir: scratch() });
    assert.equal(obs.timedOut, true);
    assert.equal(obs.signal, "SIGKILL");
  });

  it("reports an absent binary as a run with no exit, not as a pass", async () => {
    const obs = await runCopilot({ id: "none", prompt: "x", cwd: scratch(), timeoutMs: 5_000 }, { bin: "/nonexistent/copilot", outDir: scratch() });
    assert.equal(obs.exit, null);
  });

  it("refuses a live run once the budget is spent and writes the count down", () => {
    const out = scratch();
    assert.equal(reserveRun(out, 2), 1);
    assert.equal(reserveRun(out, 2), 2);
    assert.throws(() => reserveRun(out, 2), /budget spent/);
    assert.throws(() => reserveRun(scratch(), 0), /budget spent/);
  });

  it("summarizes a transcript: skills loaded, the subagent and its declared tools, denied calls and premium requests", () => {
    const ev = (type: string, data: unknown, extra: object = {}) => JSON.stringify({ type, data, ...extra });
    const text = [
      ev("tool.execution_start", { toolName: "skill", arguments: { skill: "tenet" } }),
      ev("subagent.selected", { agentName: "tenet:tenet", tools: ["read", "agent"] }),
      ev("tool.execution_start", { toolName: "bash", arguments: {} }),
      ev("tool.execution_complete", { success: false, error: { code: "denied" } }),
      ev("assistant.message", { model: "m-1", content: "" }),
      "not json",
      JSON.stringify({ type: "result", exitCode: 0, usage: { premiumRequests: 1 } }),
    ].join("\n");
    assert.deepEqual(summarize(text), {
      skills: ["tenet"], subagents: [{ name: "tenet:tenet", tools: ["read", "agent"] }], tools: { skill: 1, bash: 1 },
      denied: 1, premiumRequests: 1, model: "m-1", finalExit: 0,
    });
  });

  it("argv carries the plugin and the model only when asked", () => {
    assert.ok(!argvFor({ id: "a", prompt: "p", cwd: "/", timeoutMs: 1 }, "/l").includes("--plugin-dir"));
    assert.ok(argvFor({ id: "a", prompt: "p", cwd: "/", timeoutMs: 1, model: "m" }, "/l").includes("--model"));
  });
});

const LIVE = process.env.TENET_HOST === "cli";
describe("host CLI, live (SP-11 feasibility) [ENG-04]", { skip: !LIVE && "set TENET_HOST=cli and TENET_HOST_RUNS=<n> (spends credits; owner authorization required)", timeout: 600_000 }, () => {
  it("HC-01: the installed plugin runs the kernel headlessly, and the kernel's own state shows it", async () => {
    const out = resolve(process.env.TENET_HOST_OUT ?? ".host-runs");
    assert.ok(existsSync(resolve("plugin/kernel/tenet.mjs")), "build the bundle first: npm run build");
    reserveRun(out, Number(process.env.TENET_HOST_RUNS ?? 0));
    const repo = scratch();
    git(repo, "init", "-q");
    writeFileSync(join(repo, "a.ts"), "export const a = 1; // TODO: rename\n");
    git(repo, "add", ".");
    git(repo, "-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-qm", "init");
    const obs = await runCopilot({
      id: `hc-01-${Date.now()}`, cwd: repo, pluginDir: resolve("plugin"), timeoutMs: 300_000,
      home: join(scratch(), "copilot-home"), extraArgs: ["--allow-all-paths"],
      prompt: `The Tenet kernel is installed at ${resolve("plugin/kernel/tenet.mjs")}; run it as \`env -u NODE_OPTIONS node <that path> ...\`. `
        + "Use the Tenet plugin to open a plan contract for this request: list the TODO comments in this repository. Do not edit any file.",
      ...(process.env.TENET_HOST_MODEL ? { model: process.env.TENET_HOST_MODEL } : {}),
    }, { outDir: out });
    assert.equal(obs.timedOut, false, "the run finished in time");
    assert.ok(existsSync(join(repo, ".tenet", "state")), "the kernel created its state: a model's claim alone would not");
    const state = JSON.parse(readFileSync(join(repo, ".tenet", "state"), "utf8"));
    assert.ok(Object.values(state.work as Record<string, { profile: string }>).some((w) => w.profile === "plan"));
  });
});
