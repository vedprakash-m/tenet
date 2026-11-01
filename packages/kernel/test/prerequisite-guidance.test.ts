import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "node:test";

const plugin = join(import.meta.dirname, "../../../plugin");

it("keeps prerequisite recovery explicit in shipped entry and onboarding instructions [INS-11]", () => {
  const entry = readFileSync(join(plugin, "com.github.copilot/agents/tenet.agent.md"), "utf8");
  const onboarding = readFileSync(join(plugin, "skills/tenet-intake/resources/onboarding.md"), "utf8");
  assert.match(entry, /Node\.js.*missing/);
  assert.match(entry, /https:\/\/nodejs\.org\/en\/download/);
  assert.match(entry, /advisory: kernel unavailable/);
  assert.match(entry, /no.*\.tenet\/.*verdict.*evidence/);
  assert.match(entry, /re-check.*Node.*doctor/i);
  for (const official of [
    "https://nodejs.org/en/download",
    "https://docs.npmjs.com/downloading-and-installing-node-js-and-npm",
    "https://pnpm.io/installation",
    "https://yarnpkg.com/getting-started/install",
    "https://bun.sh/docs/installation",
    "https://git-scm.com/downloads",
  ]) assert.ok(onboarding.includes(official), `missing official prerequisite guidance: ${official}`);
  assert.match(onboarding, /never.*install.*software/i);
  assert.match(onboarding, /lockfile.*packageManager/);
  assert.match(onboarding, /--version/);
  assert.match(onboarding, /tenet inspect doctor/);
  assert.match(onboarding, /permission.*restart.*editor/i);
  assert.match(onboarding, /not.*npm ci.*missing.*package manager/i);
});

it("keeps out-of-scope improvements advisory in the shipped build instructions [QLT-10]", () => {
  const build = readFileSync(join(plugin, "skills/tenet-build/SKILL.md"), "utf8");
  assert.match(build, /outside the scope.*advisory.*"noticed, not changed".*never add it to scope or treat it as binding/i);
});

it("requires a named alternative check for nonbehavioral work [TDD-06]", () => {
  const build = readFileSync(join(plugin, "skills/tenet-build/SKILL.md"), "utf8");
  assert.match(build, /for nonbehavioral work, do not invent a test; state the alternative check.*report its result/i);
});

it("limits intake questions to action-changing decisions and gives useful options [INT-03]", () => {
  const intake = readFileSync(join(plugin, "skills/tenet-intake/SKILL.md"), "utf8");
  assert.match(intake, /ask only questions whose answers change the next dependent action/i);
  assert.match(intake, /state a recommendation, its consequences, and a reversible default where one is justified/i);
});

it("asks review to challenge acceptance-basis and test fidelity without expanding scope [REV-09]", () => {
  const review = readFileSync(join(plugin, "skills/tenet-review/SKILL.md"), "utf8");
  assert.match(review, /Stage A \(behavior and intent\)/);
  assert.match(review, /does each acceptance test truly assert its example/i);
  assert.match(review, /what required behavior has no example or check/i);
  assert.match(review, /out-of-scope-change/);
});

it("directs review to flag generated-code destinations, telemetry, credentials and permissions [SEC-09]", () => {
  const review = readFileSync(join(plugin, "skills/tenet-review/SKILL.md"), "utf8");
  assert.match(review, /new\s+network destinations, telemetry calls, credential handling and permission changes introduced in generated code/i);
});

it("distinguishes shotgun surgery from blast radius in Stage B review", () => {
  const review = readFileSync(join(plugin, "skills/tenet-review/SKILL.md"), "utf8");
  assert.match(review, /one conceptual change require edits across several\s+unrelated files or modules/i);
  assert.match(review, /distinct, nameable smell from blast radius/i);
  assert.match(review, /blast radius, which is about how many\s+callers a signature change reaches/i);
});

it("resolves factual disagreements from evidence and presents normative choices with a recommendation [AGT-07]", () => {
  const coordinator = readFileSync(join(plugin, "skills/tenet/SKILL.md"), "utf8");
  assert.match(coordinator, /resolve factual disagreements by comparing evidence/i);
  assert.match(coordinator, /present normative product or risk choices as options with a recommendation/i);
});

it("keeps reviewer and analyst child work within assigned authority and budget [AGT-06]", () => {
  const reviewer = readFileSync(join(plugin, "com.github.copilot/agents/tenet-reviewer.agent.md"), "utf8");
  const analyst = readFileSync(join(plugin, "com.github.copilot/agents/tenet-analyst.agent.md"), "utf8");
  for (const agent of [reviewer, analyst]) {
    assert.match(agent, /do not expand authority, reset the assigned budget or delegate further/i);
    assert.match(agent, /report any such violation found in evidence/i);
  }
});

it("instructs reports to include verified demo steps and available UI screenshots", () => {
  const coordinator = readFileSync(join(plugin, "skills/tenet/SKILL.md"), "utf8");
  assert.match(coordinator, /For user-facing changes, add a verified demo path with run instructions and steps showing confirmed examples/i);
  assert.match(coordinator, /for `ui`, attach captured screenshots of those examples when available/i);
  assert.match(coordinator, /Never invent commands, outcomes or screenshot paths/i);
});
