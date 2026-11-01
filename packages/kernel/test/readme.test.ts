import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const readme = readFileSync(new URL("../../../README.md", import.meta.url), "utf8");

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
});
