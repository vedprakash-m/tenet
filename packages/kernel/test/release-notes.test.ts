// tools/release-notes.ts: the draft lists what changed per disclosure item from repository facts, and the check refuses notes
// with a missing section or an unwritten statement. This proves the mechanism only; no release has used it (plan §13).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanup, git, initRepo, tmp, write } from "./helpers.ts";
import { checkNotes, draft, ITEMS, notesPath, PLACEHOLDER } from "../../../tools/release-notes.ts";

const PLAN = [
  "## 1. Dashboard", "", "**R1 structural mapping is **1 mapped / 0 host-only / 0 unmapped of 1 Musts, 0 qualified**.", "",
  "### 4.5 Owner-gate items", "", "- [ ] Project name finalized", "- [x] License chosen", "",
  "### 9.5 Release chain", "", "- [ ] Signed tag and provenance attestation", "- [x] Payload inventory", "", "### 9.6 Definition of done", "", "- [ ] Not a release-chain gate", "",
].join("\n");

function repo(root: string) {
  write(root, "specs/PRD.md", "| TST-01 | Example | Must | M0 | AC-01 |\n");
  write(root, "specs/tech-spec.md", "| AC-01 | T1 | Suite |\nThese controls do not implement signing.\n");
  write(root, "specs/plan.md", PLAN);
  write(root, "packages/kernel/test/example.test.ts", `it("maps [TST-01]", () => {});\n`);
  write(root, "packages/kernel/src/verbs/example.ts", "");
  write(root, "packages/kernel/src/decisions/example.ts", "");
  initRepo(root);
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "base");
  git(root, "tag", "v0.0.1");
}

const sectionOf = (notes: string, title: string) => notes.split(/^## /m).find((b) => b.startsWith(title)) ?? "";

describe("release notes enumerate the disclosure items", () => {
  it("lists changed paths under the item they belong to, from repository facts [LFC-02]", () => {
    const root = tmp("tenet-notes-");
    try {
      repo(root);
      write(root, "plugin/schemas/tenet.policy.schema.json", "{}");
      write(root, "packages/kernel/src/adapters/net.ts", "");
      write(root, "eval/golden.json", "{}");
      git(root, "add", "-A");
      git(root, "commit", "-q", "-m", "change");
      const notes = draft(root, "v0.0.1", "9.9.9");

      assert.match(notes, /^# Tenet 9\.9\.9 release notes/);
      assert.deepEqual(ITEMS.map((i) => i.id), ["permissions", "destinations", "executables", "schemas", "evaluators", "behavior", "matrix"]);
      for (const [i, item] of ITEMS.entries()) assert.ok(notes.includes(`## ${i + 1}. ${item.title}`), item.title);
      assert.match(sectionOf(notes, "4. Changed schemas"), /- plugin\/schemas\/tenet\.policy\.schema\.json/);
      assert.match(sectionOf(notes, "2. Changed destinations"), /- packages\/kernel\/src\/adapters\/net\.ts/);
      assert.match(sectionOf(notes, "3. Changed executable content"), /- packages\/kernel\/src\/adapters\/net\.ts/);
      assert.match(sectionOf(notes, "5. Changed evaluators"), /- eval\/golden\.json/);
      assert.match(sectionOf(notes, "6. Changed evaluated behavior"), /- eval\/golden\.json/);
      assert.match(sectionOf(notes, "7. Support matrix"), /Changed paths: none/);
      assert.match(sectionOf(notes, "1. Changed permissions"), /- plugin\/schemas\/tenet\.policy\.schema\.json/);
      assert.doesNotMatch(sectionOf(notes, "5. Changed evaluators"), /schema/);
      assert.match(notes, /Base: v0\.0\.1\./);
    } finally {
      cleanup(root);
    }
  });

  it("states mapping, plan agreement, open gates of the release chain and owner gates, and the known limit", () => {
    const root = tmp("tenet-notes-");
    try {
      repo(root);
      const notes = draft(root, null, "1.0.0");

      assert.match(notes, /1 mapped \/ 0 host-only \/ 0 unmapped of 1 Musts; 0 qualified; 1 Musts block a release audit/);
      assert.match(notes, /Plan dashboard states: 1 mapped .* \(matches\)/);
      assert.match(notes, /- Open gate: Signed tag and provenance attestation/);
      assert.match(notes, /- Open gate: Project name finalized/);
      assert.doesNotMatch(notes, /Payload inventory|Not a release-chain gate|License chosen/);
      assert.match(notes, /Known limit: These controls do not implement signing\./);
      assert.match(notes, /Changed paths: not computed \(no base\)/);

      write(root, "specs/plan.md", PLAN.replace("1 mapped / 0 host-only", "2 mapped / 0 host-only"));
      assert.match(draft(root, null), /DIFFERS or absent/);
    } finally {
      cleanup(root);
    }
  });

  it("refuses notes with a missing section or an unwritten statement, and accepts completed ones", () => {
    const root = tmp("tenet-notes-");
    try {
      repo(root);
      const fresh = draft(root, null);
      assert.equal(checkNotes(fresh).length, ITEMS.length + 1, "every section starts unwritten");
      assert.ok(fresh.includes(PLACEHOLDER));

      const written = fresh.replaceAll(PLACEHOLDER, "No change.");
      assert.deepEqual(checkNotes(written), []);
      assert.deepEqual(checkNotes(written.replace(/^Statement: No change\.$/m, "Statement:")), ["no statement written: 1. Changed permissions"]);
      assert.deepEqual(checkNotes(written.replace("## 4. Changed schemas", "## Schemas")), ["missing section: 4. Changed schemas"]);
      assert.deepEqual(checkNotes(written.replace("## Repository facts", "## Facts")), ["missing section: Repository facts"]);
      assert.deepEqual(checkNotes(written.replace(/^## Review rule disclosure[\s\S]*$/m, "")), ["missing section: Review rule disclosure"]);
    } finally {
      cleanup(root);
    }
  });

  it("keeps the default location under docs/release", () => {
    assert.equal(notesPath("0.1.0"), "docs/release/notes/v0.1.0.md");
  });
});
