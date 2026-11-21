import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "node:test";

// Owner decision D17 (UX Spec 3.2): `/tenet review …` is the same stateless review as `/tenet-review`; an
// explanation stays in chat; status, why and help are unchanged; every other request opens a contract.
const plugin = join(import.meta.dirname, "../../../plugin");
const read = (p: string) => readFileSync(join(plugin, p), "utf8");
const command = read("com.github.copilot/commands/tenet.md");
const coordinator = read("com.github.copilot/agents/tenet.agent.md");
const loopStart = coordinator.split("# Loop")[1]!.split("\n2. ")[0]!;

it("routes /tenet review to the stateless review verb, as /tenet-review does [CON-09]", () => {
  for (const text of [command, loopStart]) {
    assert.match(text, /"review …"[^\n]*`\/tenet-review`/);
    assert.match(text, /`tenet review`/);
    assert.match(text, /nothing is written to the project/i);
  }
  assert.match(loopStart, /dispatch `tenet-reviewer`/);
  assert.match(read("com.github.copilot/commands/tenet-review.md"), /Run `tenet review`/);
});

it("keeps explanations and questions in chat without a contract or .tenet/ [INS-09]", () => {
  for (const text of [command, loopStart]) {
    assert.match(text, /explain[^\n]*answer in chat/i);
    assert.match(text, /no `\.tenet\/`/);
  }
  assert.match(loopStart, /if checks are needed, offer an investigation/i);
});

it("routes feedback to a redacted stateless preview without opening work [OSS-06]", () => {
  for (const text of [command, loopStart]) {
    assert.match(text, /feedback[^\n]*tenet inspect --view export --topic feedback/i);
    assert.match(text, /nothing is sent or saved/i);
  }
});

it("leaves status, why and help unchanged and opens a contract for every other request [INS-09]", () => {
  assert.match(command, /For status, why or help, answer from `tenet inspect` and do\s+not start work/);
  assert.match(loopStart, /run `tenet inspect status`, answer, and end the turn/);
  for (const text of [command, loopStart]) {
    const otherwise = text.indexOf("Otherwise");
    assert.ok(otherwise > text.indexOf("`tenet review`") && otherwise > text.indexOf("no `.tenet/`"), "open comes last");
  }
  assert.match(command, /Otherwise open a contract and follow the loop/);
  assert.match(loopStart, /Otherwise pick a profile and run `tenet open <profile>`/);
});
