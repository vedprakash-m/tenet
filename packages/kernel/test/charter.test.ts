// The charter the Reviewer judges against: the project's own when its instruction file carries one, else the default (QLT-09, TS §7.8).
import { readFileSync } from "node:fs";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, project } from "./support/fixture.ts";
import { projectCharter } from "../src/core/charter.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const block = (text: string) => `# Rules\n\n<!-- tenet:charter:begin -->\n${text}\n<!-- tenet:charter:end -->\n\nOther prose.\n`;

describe("projectCharter [QLT-09]", () => {
  it("takes the text between one balanced pair of markers, preferring the first file given", () => {
    assert.equal(projectCharter([block("Own rule."), block("Other rule.")]), "Own rule.");
    assert.equal(projectCharter([null, block("Second file.")]), "Second file.");
  });
  it("ignores a file with no markers, unbalanced or repeated markers, an empty block, or one over 300 tokens", () => {
    assert.equal(projectCharter(["no markers", null]), undefined);
    assert.equal(projectCharter(["<!-- tenet:charter:begin -->\nopen only"]), undefined);
    assert.equal(projectCharter([block("a") + block("b")]), undefined);
    assert.equal(projectCharter([block("   ")]), undefined);
    assert.equal(projectCharter([block("word ".repeat(400))]), undefined);
  });
});

describe("the manifest carries the project's charter [QLT-09]", () => {
  const manifestFor = async (files: Record<string, string>) => {
    const p = project(files);
    roots.push(p.root);
    const h = (await p.call("open", { profile: "feature", request: "x", scopePaths: ["src/greet.ts"], lane: "standard" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    const g = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    return JSON.parse(readFileSync((g.data as any).review.manifest, "utf8"));
  };
  it("uses AGENTS.md's charter, or the default when the project has none", async () => {
    assert.equal((await manifestFor({ "AGENTS.md": block("Prefer small pure functions.") })).charter, "Prefer small pure functions.");
    assert.match((await manifestFor({ "AGENTS.md": "# no charter here\n" })).charter, /behavioral TDD/);
  });
});
