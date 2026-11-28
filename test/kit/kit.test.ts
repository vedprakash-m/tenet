import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse } from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const kit = path.join(root, "kit");
const { validate } = (await import(pathToFileURL(path.join(root, "src", "core", "schema.ts")).href)) as typeof import(
  "../../src/core/schema.js"
);

const read = (...parts: string[]) => readFile(path.join(kit, ...parts), "utf8");
const tokens = (text: string) => Math.ceil(text.length / 4);
const frontMatter = (text: string): unknown => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  return match ? parse(match[1]) : undefined;
};

async function filesUnder(directory: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(full));
    else result.push(full);
  }
  return result;
}

const specTemplates = ["intent", "vision", "requirements", "design", "experience", "plan"];

test("every specification template's front matter is valid at the starter stage (before tenet fix)", async () => {
  for (const name of specTemplates) {
    const data = frontMatter(await read("templates", `${name}.md`));
    assert.ok(data, `${name}.md has front matter`);
    const result = validate("spec-front-matter", data);
    assert.equal(result.ok, true, `${name}.md: ${JSON.stringify(result.errors)}`);
  }
});

test("front matter after onboarding records its revisions and stays valid", async () => {
  const data = frontMatter(await read("templates", "intent.md")) as { tenet: Record<string, unknown> };
  data.tenet.drafted_from = "0123abc";
  data.tenet.drafted_at_rev = "4567def";
  assert.equal(validate("spec-front-matter", data).ok, true);
});

test("the template set named by CP-0012 is complete", async () => {
  const names = new Set(await readdir(path.join(kit, "templates")));
  for (const name of [...specTemplates, "pull-request", "agents-block", "escalation"]) {
    assert.ok(names.has(`${name}.md`), `kit/templates/${name}.md exists`);
  }
});

test("the minimal pack carries the alpha.0 pack fields (tech spec §6.2)", async () => {
  const pack = parse(await read("packs", "minimal", "pack.yaml")) as Record<string, unknown>;
  for (const key of ["pack", "version", "description", "phases", "stations", "loop_backs", "lanes", "human_touches", "work_types", "rules_alpha0"]) {
    assert.ok(key in pack, `pack.yaml has ${key}`);
  }
  const rules = (pack.rules_alpha0 as { id: string }[]).map((rule) => rule.id);
  assert.ok(rules.includes("acceptance-passed"));
  assert.ok(!rules.includes("acceptance-proven"));
});

test("[AB-B4] [F-12] skills use installed names and stay within their 2,000-token budget", async () => {
  for (const name of ["draft-specs", "work-a-change", "review-with-findings"]) {
    const text = await read("skills", name, "SKILL.md");
    assert.ok(tokens(text) <= 2000, `${name}: ${tokens(text)} tokens`);
    assert.equal(frontMatter(text) && (frontMatter(text) as Record<string, unknown>).name, `tenet-${name}`);
  }
  const drafting = await read("skills", "draft-specs", "SKILL.md");
  assert.match(drafting, /assignment\.questions\.project_kind/);
  assert.match(drafting, /assignment\.questions\.generic/);
  assert.match(drafting, /Ask at most `assignment\.question_limit` questions in total/);
  assert.match(drafting, /project_kind` first, then fill the remaining count from `assignment\.questions\.generic`/);
  assert.match(drafting, /Never repeat a question/);
});

test("[AC-E7] [R2-24] drafting skill reports readiness and commits only when asked", async () => {
  const drafting = await read("skills", "draft-specs", "SKILL.md");
  assert.match(drafting, /Tell the user the draft is ready/i);
  assert.match(drafting, /Commit or open a pull request only if the user asked/i);
  assert.match(drafting, /tenet fix/);
  assert.match(drafting, /tenet check/);
  assert.match(drafting, /tenet onboard --card/);
});

test("[AC-D1] [R2-02] [AB-D1] [F-01] release docs include a working Windows checksum command", async (t) => {
  const readme = await readFile(path.join(root, "README.md"), "utf8");
  const gettingStarted = await readFile(path.join(root, "docs", "getting-started.md"), "utf8");
  const powershellCommands: string[] = [];
  for (const text of [readme, gettingStarted]) {
    assert.match(text, /release tarball/i);
    assert.match(text, /SHA256SUMS/);
    const command = /^~~~powershell\r?\n([^\r\n]+)\r?\n~~~$/m.exec(text)?.[1];
    assert.ok(command?.includes("Get-FileHash"));
    assert.ok(command.includes("Get-Content SHA256SUMS"));
    powershellCommands.push(command);
  }
  assert.equal(powershellCommands[0], powershellCommands[1]);
  if (process.platform === "win32") {
    const cwd = await mkdtemp(path.join(tmpdir(), "tenet-checksum-"));
    t.after(() => rm(cwd, { recursive: true, force: true }));
    const tarball = "vedprakash-m-tenet-0.0.0.tgz";
    const bytes = Buffer.from("synthetic release\n", "utf8");
    await writeFile(path.join(cwd, tarball), bytes);
    const digest = createHash("sha256").update(bytes).digest("hex");
    await writeFile(path.join(cwd, "SHA256SUMS"), `${digest}  ${tarball}\n`);
    const command = powershellCommands[0]?.replaceAll("<version>", "0.0.0") ?? "";
    const shell = [
      { executable: "pwsh.exe", setup: "" },
      {
        executable: "powershell.exe",
        setup: "Import-Module Microsoft.PowerShell.Utility -Force; ",
      },
    ].find(({ executable }) => {
      const probe = spawnSync(
        executable,
        ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "$PSVersionTable.PSVersion.Major"],
        { encoding: "utf8", shell: false, windowsHide: true },
      );
      return probe.status === 0;
    });
    assert.ok(shell, "a Windows PowerShell executable is available");
    const child = spawnSync(
      shell.executable,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `${shell.setup}${command}`,
      ],
      { cwd, encoding: "utf8", shell: false, windowsHide: true },
    );
    assert.equal(child.status, 0, child.stderr || child.stdout);
  }
});

test("[AC-E6] [R2-22] kit files cite only shipped files", async () => {
  for (const filename of await filesUnder(kit)) {
    const text = await readFile(filename, "utf8");
    assert.doesNotMatch(text, /(?:contracts|onboarding|algorithms|agents)\.md/);
  }
});

test("[AB-D9] [F-13] pull-request template has no live Implements example", async () => {
  const template = await read("templates", "pull-request.md");
  assert.doesNotMatch(template, /^Implements:\s*R-1$/m);
  assert.doesNotMatch(template, /^Implements:\s*R-1/m);
  assert.match(template, /<!--\s*Worked example:/);
});

test("[AB-D11] [F-02] FAQ and docs index are user-facing with no per-answer sources", async () => {
  const faq = await readFile(path.join(root, "docs", "faq.md"), "utf8");
  assert.doesNotMatch(faq, /^Source:/m);
  const docsIndex = await readFile(path.join(root, "docs", "README.md"), "utf8");
  assert.doesNotMatch(docsIndex, /Written from M1|CP-0013/);
});

test("agent cards and the default practices are present with front matter", async () => {
  for (const name of ["drafter", "spec-reviewer"]) {
    const card = frontMatter(await read("agents", `${name}.md`)) as Record<string, unknown> | undefined;
    assert.ok(card, `${name}.md has front matter`);
    assert.equal(card.name, name);
  }
  assert.ok((await read("practices", "default.md")).trim().length > 0);
});

test("a blessed section must say how it was recorded and where its blessed copy is", async () => {
  const data = frontMatter(await read("templates", "intent.md")) as { sections: Record<string, Record<string, unknown>> };
  data.sections.vision.state = "blessed";
  assert.equal(validate("spec-front-matter", data).ok, false);
});

test("the minimal pack and every agent card validate through the schema registry", async () => {
  const pack = validate("pack", parse(await read("packs", "minimal", "pack.yaml")));
  assert.equal(pack.ok, true, JSON.stringify(pack.errors));
  for (const name of ["drafter", "spec-reviewer"]) {
    const card = validate("agent-card", frontMatter(await read("agents", `${name}.md`)));
    assert.equal(card.ok, true, `${name}: ${JSON.stringify(card.errors)}`);
  }
});
