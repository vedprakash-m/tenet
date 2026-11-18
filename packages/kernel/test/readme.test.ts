import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const readme = readFileSync(new URL("../../../README.md", import.meta.url), "utf8");
const pluginReadme = readFileSync(new URL("../../../plugin/README.md", import.meta.url), "utf8");
const removalGuide = readFileSync(new URL("../../../docs/user/install-and-remove.md", import.meta.url), "utf8");

describe("installation README [INS-02]", () => {
  it("states publisher and source-verification limits without draft placeholders", () => {
    assert.doesNotMatch(readme, /PLACEHOLDER|<!-- DRAFT/);
    assert.match(readme, /Publisher and verification/);
    assert.match(readme, /publisher.{0,80}not designated/i);
    assert.match(readme, /https:\/\/github\.com\/vedprakash-m\/tenet/);
    assert.match(readme, /signed release|provenance/i);
  });

  it("documents prerequisites, support, assistance, permissions, first task and lifecycle before use", () => {
    const beforeInstall = readme.split("## Install")[0]!;
    for (const section of [
      "## Before you install",
      "Support matrix",
      /assistance levels/i,
      "Permissions and executable content",
      "Publisher and verification",
    ]) assert.ok(typeof section === "string" ? beforeInstall.includes(section) : section.test(beforeInstall),
      `README is missing ${section}`);

    assert.match(readme, /## Three requests to start with/);
    assert.match(readme, /## Update/);
    assert.match(readme, /## Remove/);
  });

  it("gives safe preview removal guidance before the plugin is removed", () => {
    for (const [name, text] of [["root README", readme], ["plugin README", pluginReadme], ["removal guide", removalGuide]] as const) {
      assert.match(text, /help uninstall[\s\S]*remov(?:e|ing) the plugin/i, name);
      assert.match(text, /cleanup removal is disabled/i, name);
      assert.match(text, /residue (?:list|listing) is incomplete/i, name);
      assert.match(text, /(?:optionally|optional)[^.]*\.tenet\//i, name);
    }
  });

  it("warns about the observed Windows metadata-link exposure", () => {
    for (const [name, text] of [["root README", readme], ["plugin README", pluginReadme]] as const) {
      assert.match(text, /On Windows,[^.]*linked installed Vitest metadata[^.]*outside the project/i, name);
      assert.match(text, /Do not use Tenet in untrusted workspaces or with untrusted installed dependencies/i, name);
    }
  });
});

describe("policy-blocked install [INS-08]", () => {
  it("explains the host's own recovery path before the install steps, without claiming Tenet detects policy", () => {
    const beforeInstall = readme.split("## Install")[0]!;
    assert.match(beforeInstall, /If policy blocks installation or a required feature/);
    assert.match(beforeInstall, /ask whoever manages your Copilot organization settings/);
    assert.match(beforeInstall, /Tenet cannot see the policy/);
    assert.match(beforeInstall, /unobserved/);
  });
});
