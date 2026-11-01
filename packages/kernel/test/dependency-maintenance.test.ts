import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const root = new URL("../../../", import.meta.url);
const dependabot = readFileSync(new URL(".github/dependabot.yml", root), "utf8");
const security = readFileSync(new URL("SECURITY.md", root), "utf8");

it("schedules monthly updates for repository and starter npm dependencies [QLT-16]", () => {
  const entries = [...dependabot.matchAll(
    /-\s+package-ecosystem:\s*npm\s+directory:\s*(\/[^\n]*)\s+schedule:\s+interval:\s*monthly/g,
  )].map((match) => match[1]);
  assert.deepEqual(entries, ["/", "/plugin/skills/tenet-starter-ts-web-api/template"]);
});

it("applies the published critical-vulnerability response windows to starter dependencies [QLT-16]", () => {
  const maintenance = security.match(/## Starter dependency maintenance\n([\s\S]*?)(?=\n## |$)/)?.[1];
  assert.ok(maintenance, "missing starter dependency maintenance policy");
  assert.match(maintenance, /must enable Dependabot alerts and security updates/i);
  assert.match(maintenance, /does not verify whether those settings are enabled/i);
  assert.match(maintenance, /critical vulnerability report or alert.*acknowledge it within 3 days.*decide on a fix, mitigation or withdrawal within 7 days/i);
});
