// Local synthetic Playwright characterization only. Uses installed dependencies/cache; never installs or downloads.
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const audit = dirname(fileURLToPath(import.meta.url));
const bodyCapture = process.argv.includes("--body");
const template = resolve(audit, "../../../plugin/skills/tenet-starter-ts-web-api/template");
const require = createRequire(join(template, "package.json"));
const playwright = require("@playwright/test");
const version = require("@playwright/test/package.json").version;
const executable = playwright.chromium.executablePath();
if (!existsSync(executable)) throw new Error("The installed Playwright Chromium cache is missing; no download attempted.");
const fixture = realpathSync(mkdtempSync(join(tmpdir(), "tenet-demo-report-")));
try {
  symlinkSync(join(template, "node_modules"), join(fixture, "node_modules"), "dir");
  mkdirSync(join(fixture, "run/tmp"), { recursive: true });
  const reportPath = join(fixture, "run/playwright.json");
  writeFileSync(join(fixture, "playwright.config.mjs"), `export default {
    testDir: '.', testMatch: 'capture.spec.mjs', workers: 1, retries: 0,
    outputDir: process.env.TMPDIR + '/playwright-output',
    projects: [{ name: 'synthetic-chromium', use: { browserName: 'chromium', launchOptions: {executablePath: ${JSON.stringify(executable)}}, viewport: {width: 640, height: 200} } }]
  };\n`);
  writeFileSync(join(fixture, "capture.spec.mjs"), `import {test,expect} from '@playwright/test';
    test.describe('synthetic demo', () => {
      test('confirmed example [EX-001-demo.1]', async ({page,browser}, testInfo) => {
        testInfo.annotations.push({type:'browserVersion',description:browser.version()});
        await page.route('**/*', route => route.abort());
        await page.setContent('<!doctype html><title>Synthetic demo</title><h1>Example result</h1><p>Local synthetic content only.</p>');
        await expect(page.getByRole('heading', {name:'Example result'})).toBeVisible();
        ${bodyCapture ? `const body = await page.screenshot();
        await testInfo.attach('tenet-demo:EX-001-demo.1', {body,contentType:'image/png'});` : `const path = testInfo.outputPath('tenet-demo-EX-001-demo.1.png');
        await page.screenshot({path});
        await testInfo.attach('tenet-demo:EX-001-demo.1', {path,contentType:'image/png'});`}
      });
    });\n`);
  const result = spawnSync(process.execPath, [require.resolve("@playwright/test/cli"), "test", "--config=playwright.config.mjs", "--reporter=json"], {
    cwd: fixture, encoding: "utf8", timeout: 60_000,
    env: { ...process.env, TMPDIR: join(fixture, "run/tmp"), PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath, CI: "1" },
  });
  if (result.status !== 0) throw new Error(`Synthetic Playwright exited ${result.status}: ${result.stderr || result.stdout}`);
  const raw = JSON.parse(readFileSync(reportPath, "utf8"));
  const entries = [];
  function walk(suites, parents = []) {
    for (const suite of suites) {
      const titles = [...parents, suite.title];
      for (const spec of suite.specs ?? []) for (const test of spec.tests) for (const [index, attempt] of test.results.entries()) {
        const attachments = (attempt.attachments ?? []).map(attachment => {
          const bytes = attachment.path ? readFileSync(attachment.path) : Buffer.from(attachment.body, "base64");
          return {
            keys: Object.keys(attachment), name: attachment.name, contentType: attachment.contentType,
            pathRepresentation: attachment.path ? (attachment.path.startsWith(fixture) ? "<fixture>/" + relative(fixture, attachment.path) : "outside-fixture") : null,
            pathIsAbsolute: attachment.path?.startsWith("/") ?? false, bytes: bytes.length,
            ...(bodyCapture ? { inlineBodyPresent: Object.hasOwn(attachment, "body") } : {}),
            sha256: createHash("sha256").update(bytes).digest("hex"), pngSignature: bytes.subarray(0, 8).toString("hex"),
            width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20),
          };
        });
        entries.push({
          suiteTitles: titles, specTitle: spec.title, specFile: spec.file, specOk: spec.ok,
          testKeys: Object.keys(test), projectId: test.projectId, projectName: test.projectName,
          browserVersion: test.annotations?.find(annotation => annotation.type === "browserVersion")?.description,
          testStatus: test.status, expectedStatus: test.expectedStatus,
          resultIndex: index, resultKeys: Object.keys(attempt), retry: attempt.retry, status: attempt.status,
          attachments,
        });
      }
      walk(suite.suites ?? [], titles);
    }
  }
  walk(raw.suites);
  const physicalPngs = [];
  const inspectPngs = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) inspectPngs(path);
      else if (entry.isFile() && entry.name.endsWith(".png")) {
        const bytes = readFileSync(path);
        physicalPngs.push({ path: "<fixture>/" + relative(fixture, path), bytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex") });
      }
    }
  };
  if (bodyCapture) inspectPngs(join(fixture, "run"));
  const observation = {
    characterizedOn: "2026-11-01", scope: "Local synthetic browser/report observation; no native host, model, account, application server or qualification campaign.",
    versions: { node: process.version, playwright: version, platform: process.platform, arch: process.arch,
      chromiumCacheEntry: executable.match(/chromium-[0-9]+/)?.[0] ?? "unknown" },
    fixture: { titleTag: "EX-001-demo.1", capture: bodyCapture ? "page.setContent, heading assertion, page.screenshot() Buffer, testInfo.attach({body,contentType:'image/png'})" : "page.setContent, heading assertion, page.screenshot, testInfo.attach", requests: "all page requests aborted", downloadsOrInstalls: false },
    report: { attachmentLocation: "suites[].suites[].specs[].tests[].results[].attachments[]", topLevelKeys: Object.keys(raw), stats: raw.stats, entries },
    ...(bodyCapture ? { physicalPngCount: physicalPngs.length, physicalPngs,
      comparison: { pathCaptureArtifact: "demo-report-characterization.json", pathCapturePhysicalFiles: "One helper original plus one Playwright attachment copy was observed in the original path-based run.",
        bufferConstraint: "page.screenshot() returns a complete encoded Buffer before caller-side size validation; this does not establish a pre-allocation or disk-write bound." } } : {}),
    limits: [
      "One passing test, one named project, one attempt (retry=0); failed/retried/multi-project attachments were not characterized.",
      "The explicit attachment name binds the declared example tag; the report does not independently prove depiction or accepted-basis membership.",
      bodyCapture ? "The inline body was decoded for byte/digest checks; no physical PNG existed under the run directory. The temporary report was removed after extraction." : "Existence, bytes and digest were checked during this run; temporary artifacts were removed after extraction.",
      "No receipt/schema/finish/capture feature was activated; no host screenshot display was observed.",
    ],
  };
  writeFileSync(join(audit, bodyCapture ? "demo-body-report-characterization.json" : "demo-report-characterization.json"), JSON.stringify(observation, null, 2) + "\n");
  process.stdout.write(`Observed ${entries.length} result and ${entries.reduce((n,e) => n + e.attachments.length,0)} attachment.\n`);
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
