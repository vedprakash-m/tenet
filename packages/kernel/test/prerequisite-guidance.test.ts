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

it("keeps project handover documentation current without inventing evidence or rewriting decisions [QLT-08]", () => {
  const build = readFileSync(join(plugin, "skills/tenet-build/SKILL.md"), "utf8");
  assert.match(build, /Keep README run instructions, decision records, the architecture doc and CHANGELOG current for the change before handover/);
  assert.match(build, /Record only verified commands and outcomes; preserve decision history and disclose missing or unverified documentation/);
});

it("limits intake questions to action-changing decisions and gives useful options [INT-03]", () => {
  const intake = readFileSync(join(plugin, "skills/tenet-intake/SKILL.md"), "utf8");
  assert.match(intake, /ask only questions whose answers change the next dependent action/i);
  assert.match(intake, /state a recommendation, its consequences, and a reversible default where one is justified/i);
});

it("bounds thin-answer follow-up to the first intake and unanswered dimensions", () => {
  const intake = readFileSync(join(plugin, "skills/tenet-intake/SKILL.md"), "utf8");
  const rules = intake.split("## Rules")[1]!.split("## Record")[0]!;
  assert.match(rules, /a new project or the first Standard-or-deeper change in code you have not worked in/i);
  assert.match(rules, /one-clause answer on purpose, users or a non-goal/i);
  assert.match(rules, /one concrete follow-up per thin dimension before the plan is drafted/i);
  assert.match(rules, /never a second round on the same dimension/i);
  assert.match(rules, /never follow up on a dimension the user already answered substantively/i);
});

it("previews the new-project conventions draft at kickoff without silently writing it", () => {
  const intake = readFileSync(join(plugin, "skills/tenet-intake/SKILL.md"), "utf8");
  const onboarding = readFileSync(join(plugin, "skills/tenet-intake/resources/onboarding.md"), "utf8");
  const draft = readFileSync(join(plugin, "skills/tenet-intake/resources/conventions-draft.md"), "utf8");
  const greenfield = onboarding.split("## Greenfield")[1]!.split("## Brownfield")[0]!;
  const brownfield = onboarding.split("## Brownfield")[1]!;
  assert.match(intake, /no content outside Tenet's own charter markers/i);
  assert.match(intake, /for a new project, show the draft in the kickoff after purpose, scope and constraints/i);
  assert.match(intake, /write it only on a yes/i);
  assert.match(intake, /never repeat after a no or once real content exists/i);
  assert.match(greenfield, /kickoff card[\s\S]*preview the instruction-file draft[\s\S]*\*\*Scaffold, check, commit\*\*/i);
  assert.match(greenfield, /no content outside Tenet's own charter markers/i);
  assert.match(greenfield, /user has not declined/i);
  assert.match(greenfield, /write it only on a yes/i);
  assert.doesNotMatch(greenfield, /scaffold, check, commit[^\n]*then offer the instruction-file draft/i);
  assert.match(brownfield, /no content outside Tenet's own charter markers and the user has not declined/i);
  assert.match(draft, /for a new project, preview this alongside the kickoff/i);
  assert.match(draft, /no content outside Tenet's own charter markers/i);
  assert.match(draft, /preview it as one file; write it only on a yes/i);
  assert.match(draft, /never offer it again after a no or once real content exists/i);
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
  assert.match(coordinator, /For user-facing changes: verified run instructions and confirmed-example steps/i);
  assert.match(coordinator, /Guided: read `tenet-build` handover only/);
  assert.match(coordinator, /for `ui`, attach available captured screenshots of those examples/i);
  assert.match(coordinator, /Never invent commands, outcomes or screenshot paths/i);
});

it("offers a consented, responding Guided demo without treating it as verification [RES-08]", () => {
  const build = readFileSync(join(plugin, "skills/tenet-build/SKILL.md"), "utf8");
  assert.match(build, /In Guided style, offer to start the local app.*host terminal under native consent/);
  assert.match(build, /never through the kernel runner/);
  assert.match(build, /Confirm the local URL responds before calling it running/);
  assert.match(build, /report a failed launch or response without claiming success/);
  assert.match(build, /where local-only development credentials are kept \(never their values\)/);
  assert.match(build, /how to stop the app, and one domain task showing a confirmed example/);
  assert.match(build, /Keep verification databases separate from development data/);
  assert.match(build, /A running demo is not test evidence/);
  assert.match(build, /For a library, CLI or back-end change with nothing to open, give a verified command or call as "Use it:" instead/);
  assert.match(build, /omit this section of the result when nothing is user-facing/);
});
