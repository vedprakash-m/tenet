// Judging a shared file against what was adopted from it (TS §7.8, §8.5). Pure.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sha256 } from "../src/core/ids.ts";
import { blockHash } from "../src/core/intent-md.ts";
import { judgeIntentFile, judgePolicyFile } from "../src/core/trust.ts";

const policy = { protected_paths: ["db/**", "infra/**"] };
const entry = (p: object) => ({ hash: sha256(JSON.stringify(p)), restrictions: p as Record<string, unknown> });

describe("judging tenet.policy.json against the adopted one", () => {
  it("an unchanged file is the same", () => assert.deepEqual(judgePolicyFile(entry(policy), JSON.stringify(policy)), { kind: "same" }));
  it("a tightening is applied and nothing waits", () => {
    const j = judgePolicyFile(entry(policy), JSON.stringify({ protected_paths: [...policy.protected_paths, "ops/**"] }));
    assert.equal(j.kind === "changed" && j.pending.length, 0);
    assert.equal(j.kind === "changed" && j.applied.length, 1);
  });
  it("a loosening waits, and the previous rule stays in what is in force", () => {
    const j = judgePolicyFile(entry(policy), JSON.stringify({ protected_paths: ["db/**"] }));
    assert.ok(j.kind === "changed");
    assert.equal(j.kind === "changed" && j.pending.length, 1);
    assert.deepEqual(j.kind === "changed" && j.restrictions.protected_paths, ["db/**", "infra/**"]);
  });
  it("a file that is not valid is unreadable, and names the key", () => {
    assert.equal(judgePolicyFile(entry(policy), "{ not json").kind, "unreadable");
    const j = judgePolicyFile(entry(policy), JSON.stringify({ protected_path: [] }));
    assert.ok(j.kind === "unreadable" && /protected_paths/.test(j.message));
  });
});

describe("judging INTENT.md against what Tenet wrote", () => {
  const body = "**REQ-001-aaa** a loan is due in 14 days\n";
  const text = (b: string, before = "") => `${before}<!-- tenet:begin REQ-001-aaa -->\n${b}<!-- tenet:end REQ-001-aaa -->\n`;
  const e = { hash: sha256(text(body)), restrictions: { blocks: { "REQ-001-aaa": blockHash(body) } } };
  it("an unchanged file is the same", () => assert.deepEqual(judgeIntentFile(e, text(body)), { kind: "same" }));
  it("text outside the blocks is the user's own and only refreshes the recorded hash", () => {
    const j = judgeIntentFile(e, text(body, "# My notes\n"));
    assert.equal(j.kind, "own-text");
  });
  it("a block whose body changed is reported by ID", () => assert.deepEqual(judgeIntentFile(e, text("**REQ-001-aaa** due in 30 days\n")), { kind: "edited", blocks: ["REQ-001-aaa"] }));
  it("damaged markers are reported with their place", () => {
    const j = judgeIntentFile(e, "<!-- tenet:begin REQ-001-aaa -->\nno end\n");
    assert.ok(j.kind === "invalid" && /line 1/.test(j.where));
  });
});
