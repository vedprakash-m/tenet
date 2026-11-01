import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const checklist = readFileSync(new URL("../../../docs/release-checklist.md", import.meta.url), "utf8");

describe("pre-publication source review [OSS-05]", () => {
  it("requires separate working-tree, reachable-history and package-inclusion reviews", () => {
    assert.match(checklist, /## Source tree review/);
    assert.match(checklist, /tracked, untracked and ignored files/i);
    assert.match(checklist, /## Reachable history review/);
    assert.match(checklist, /every commit reachable from the exact publication ref/i);
    assert.match(checklist, /## Package inclusion review/);
    assert.match(checklist, /separate from both source-tree and history review/i);
    assert.match(checklist, /reviewer.{0,80}publication ref.{0,80}findings/i);
    assert.match(checklist, /privacy-check\.ts --range/);
  });
});
