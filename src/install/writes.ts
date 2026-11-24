import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { parseDocument, stringify } from "yaml";
import { confine, writeAtomic } from "../core/fs.js";
import { message } from "../core/messages.js";
import { fail } from "../core/output.js";
import { compareUtf16 } from "./hosts.js";
import { preflight as runPreflight } from "./preflight.js";
import {
  blockMarker,
  decodeJson,
  jsonFile,
  localManifestJson,
  manifestJson,
  pendingJson,
  pointerValue,
  replaceBlock,
  setJsonPointerBytes,
  setPointer,
  sha256Bytes,
} from "./manifest.js";
import type {
  InitPlan,
  InitResult,
  InitWrote,
  InstallManifest,
  ManifestBlock,
  ManifestKey,
  PendingManifest,
  PendingWrite,
  PreflightOptions,
  PreflightResult,
  RunnerFact,
  LocalManifest,
  LocalManifestKey,
  WriteSet,
} from "./types.js";
import { localProfileRoot, localProfileRoots } from "./environment.js";

export type WritePlanOptions = PreflightOptions & {
  force?: boolean;
};

export type ApplyPlanOptions = {
  fault?: {
    after?: "pending" | string | number;
  };
  localProfileRoot?: string;
};

type FileState = {
  exists: boolean;
  bytes: Buffer | null;
  text: string | null;
  sha256: string | null;
};

type ManagedBlock = {
  replacement: string;
  target: string;
  previous: string | null;
  prefixSep: "" | "\n" | "\r\n";
};

type PlannedFile = {
  path: string;
  content: string;
};

function installError(code: "TN-INIT-EXISTS" | "TN-PATH-ESCAPE", itemPath: string): Error & { code: string; finding: unknown } {
  const words = message(code, { path: itemPath });
  const finding = { ...fail(code, words.message, words.fix), file: itemPath };
  return Object.assign(new Error(words.message), { code, finding });
}

function pathError(itemPath: string): never {
  throw installError("TN-PATH-ESCAPE", itemPath);
}

async function fileState(filename: string): Promise<FileState> {
  try {
    const bytes = await readFile(filename);
    return { exists: true, bytes, text: bytes.toString("utf8"), sha256: sha256Bytes(bytes) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { exists: false, bytes: null, text: null, sha256: null };
    }
    throw error;
  }
}

async function listFiles(root: string, relative = ""): Promise<string[]> {
  const entries = await readdir(path.join(root, ...relative.split("/").filter(Boolean)), { withFileTypes: true });
  const output: string[] = [];
  for (const entry of entries.sort((left, right) => compareUtf16(left.name, right.name))) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) output.push(...(await listFiles(root, name)));
    else if (entry.isFile()) output.push(name);
  }
  return output;
}

async function kitFiles(kitPath: string): Promise<Array<{ path: string; content: string }>> {
  const output: Array<{ path: string; content: string }> = [];
  for (const relative of await listFiles(kitPath)) {
    const content = await readFile(path.join(kitPath, ...relative.split("/")));
    output.push({ path: relative, content: content.toString("utf8") });
  }
  return output.sort((left, right) => compareUtf16(left.path, right.path));
}

async function kitDigest(files: Array<{ path: string; content: string }>): Promise<string> {
  const rows = files
    .map((file) => ({ path: file.path.replaceAll("\\", "/"), hash: sha256Bytes(Buffer.from(file.content, "utf8")) }))
    .sort((left, right) => Buffer.compare(Buffer.from(left.path, "utf8"), Buffer.from(right.path, "utf8")))
    .map((file) => `${file.path}\0${file.hash}`);
  return sha256Bytes(rows.join("\n"));
}

function installedKitPath(): string {
  return fileURLToPath(new URL("../../kit/", import.meta.url));
}

function release(
  options: WritePlanOptions,
): { package: string; version: string; integrity: string } {
  const environment = options.environment ?? {};
  const registryPackage = environment.registry?.package ?? "@vedprakash-m/tenet";
  const version = environment.installedVersion ?? process.env.npm_package_version ?? "0.0.0";
  const integrity = environment.registry?.releases?.[version]?.integrity ??
    process.env.TENET_INSTALL_INTEGRITY;
  if (!integrity) {
    throw new Error(`No registry integrity was supplied for ${registryPackage}@${version}.`);
  }
  return { package: registryPackage, version, integrity };
}

function taggingLine(runner: RunnerFact | null): string {
  switch (runner?.kind) {
    case "pytest":
      return '`def test_retries_once_tenet_AB_1():` or `record_property("tenet.case", "AB-1")`';
    case "go":
      return '`t.Run("[AB-1] retries once", ...)`';
    case "vitest":
    case "jest":
    case "node:test":
      return '`it("[AB-1] retries once after a timeout", ...)`';
    default:
      return "`tenet_<ID with underscores>` in the test name, or the `tenet.case` property";
  }
}

function documentsLine(): string {
  return [
    "tenet/vision.md (L0)",
    "tenet/specs/prd.md (L1)",
    "tenet/specs/tech-spec.md (L2)",
    "tenet/specs/ux-spec.md (L2)",
    "tenet/specs/plan.md (L2)",
  ].join(", ");
}

function templateBody(source: string, bindings: Record<string, string>): string {
  let output = source;
  for (const [name, value] of Object.entries(bindings)) {
    output = output.replaceAll(`{${name}}`, value);
  }
  const marker = "<!-- tenet:end -->";
  const end = output.indexOf(marker);
  return `${end >= 0 ? output.slice(0, end + marker.length) : output.trimEnd()}\n`;
}

async function agentsBlock(
  kitPath: string,
  version: string,
  runner: RunnerFact | null,
): Promise<string> {
  const template = await readFile(path.join(kitPath, "templates", "agents-block.md"), "utf8");
  const workingRules = (await readFile(path.join(kitPath, "practices", "default.md"), "utf8")).trimEnd();
  return templateBody(template, {
    version,
    "documents with their levels": documentsLine(),
    prefix: "R",
    "tagging line for the detected runner": taggingLine(runner),
    "L0–L2 documents": "the L0–L2 documents listed above",
    records: "tenet",
    "working rules": workingRules,
  });
}

async function pullRequestTemplate(kitPath: string, version: string): Promise<string> {
  const template = await readFile(path.join(kitPath, "templates", "pull-request.md"), "utf8");
  let output = template.replaceAll("{version}", version).replaceAll("{records}", "tenet");
  return `${output.replace(/\r\n/g, "\n").replace(/\n+$/, "")}\n`;
}

async function pullRequestBlock(kitPath: string, version: string): Promise<string> {
  const source = await pullRequestTemplate(kitPath, version);
  const start = source.indexOf(`<!-- tenet:begin v${version} -->`);
  const end = source.indexOf("<!-- tenet:end -->", start);
  return start >= 0 && end >= 0 ? `${source.slice(start, end + "<!-- tenet:end -->".length)}\n` : templateBody(source, {});
}

function hostPointerBlock(version: string): string {
  return `${blockMarker("markdown", version)}
Read and follow [AGENTS.md](AGENTS.md).
<!-- tenet:end -->
`;
}

function ignoreBlock(version: string): string {
  return `${blockMarker("yaml", version)}
.tenet/*
!.tenet/manifest.json
!.tenet/manifest.local.json
!.tenet/kit/
${"# tenet:end"}
`;
}

function attributesBlock(version: string, paths: string[]): string {
  const lines = [...new Set(paths)].sort(compareUtf16).map((itemPath) => `${itemPath} text eol=lf`);
  return `${blockMarker("yaml", version)}
${lines.join("\n")}
# tenet:end
`;
}

function clonePlan(plan: InitPlan): InitPlan {
  return {
    ...plan,
    created: [...plan.created],
    blocks: plan.blocks.map((item) => ({ ...item })),
    keys: plan.keys.map((item) => ({ ...item })),
    local_keys: plan.local_keys.map((item) => ({ ...item })),
    hosts: plan.hosts.map((item) => ({ ...item })),
  };
}

function gitHubWorkflowName(source: string, fallback: string): string {
  const document = parseDocument(source, { prettyErrors: true, uniqueKeys: true });
  if (document.errors.length > 0) return fallback;
  const name = (document.toJS({ maxAliasCount: 50 }) as { name?: unknown })?.name;
  return typeof name === "string" && name ? name : fallback;
}

async function toolchainBindings(cwd: string, runner: RunnerFact | null): Promise<Record<string, string>> {
  const readVersion = async (relative: string, fallback: string): Promise<string> => {
    const text = await fileState(path.join(cwd, relative));
    const value = text.text?.trim();
    return value || fallback;
  };
  const nodeVersion = runner && ["vitest", "jest", "node:test", "ctrf", "other"].includes(runner.kind)
    ? await readVersion(".nvmrc", "22")
    : "22";
  if (runner?.kind === "pytest") {
    const python = await readVersion(".python-version", "3.12");
    return {
      "node version": nodeVersion,
      "toolchain step": `      - uses: actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065 # v5.6.0\n        with: {python-version: ${JSON.stringify(python)}}`,
    };
  }
  if (runner?.kind === "go") {
    const goMod = await fileState(path.join(cwd, "go.mod"));
    const version = /^go\s+(\S+)/m.exec(goMod.text ?? "")?.[1] ?? "stable";
    return {
      "node version": nodeVersion,
      "toolchain step": `      - uses: actions/setup-go@0a12ed9d6a96ab950c8f026ed9f722fe0da7ef32 # v5.0.2\n        with: {go-version: ${JSON.stringify(version)}}`,
    };
  }
  return { "node version": nodeVersion, "toolchain step": "" };
}

function workflowTemplate(source: string, bindings: Record<string, string>): string {
  let output = source;
  for (const [name, value] of Object.entries(bindings)) output = output.replaceAll(`<${name}>`, value);
  return `${output.replace(/\r\n/g, "\n").replace(/\n+$/, "")}\n`;
}

function reporterFlags(runner: RunnerFact): string {
  switch (runner.kind) {
    case "vitest": return " --reporter=default --reporter=junit --outputFile.junit=.tenet/reports/test.xml";
    case "jest": return " --ci --json --outputFile=.tenet/reports/test.json";
    case "node:test":
      return " --test-reporter=spec --test-reporter-destination=stdout --test-reporter=junit --test-reporter-destination=.tenet/reports/test.xml";
    case "pytest": return " --junitxml=.tenet/reports/test.xml";
    case "go":
      return " -json";
    case "ctrf":
    case "other":
      return "";
  }
}

function reporterCommandMatches(command: string, runner: RunnerFact): boolean {
  if (/\b(?:npm|pnpm)\s+(?:run\s+)?test\b|\byarn\s+test\b/i.test(command)) return true;
  switch (runner.kind) {
    case "vitest": return /\bvitest\b/i.test(command);
    case "jest": return /\bjest\b/i.test(command);
    case "node:test": return /\bnode\b[^\r\n]*--test\b/i.test(command);
    case "pytest": return /\bpytest\b/i.test(command);
    case "go": return /\bgo\s+test\b/i.test(command);
    case "ctrf": return /\bctrf\b/i.test(command);
    case "other": return /\b(?:npm|pnpm|yarn)\s+test\b/i.test(command);
  }
}

type SourceLine = { text: string; ending: string };

function splitLines(source: string): SourceLine[] {
  const output: SourceLine[] = [];
  const expression = /([^\r\n]*)(\r\n|\n|$)/g;
  for (const match of source.matchAll(expression)) {
    if (match.index === source.length) break;
    output.push({ text: match[1] ?? "", ending: match[2] ?? "" });
  }
  return output;
}

function indentationLength(value: string): number {
  return /^(\s*)/.exec(value)?.[1]?.length ?? 0;
}

function joinLines(lines: SourceLine[]): string {
  return lines.map((line) => line.text + line.ending).join("");
}

function selectedStepId(lines: SourceLine[], first: number, last: number): string | null {
  for (let index = first; index < last; index += 1) {
    const match = /^\s+(?:-\s+)?id:\s*([^\s#]+)/.exec(lines[index]?.text ?? "");
    if (match?.[1]) return match[1];
  }
  return null;
}

function synthesizeStepId(lines: SourceLine[], testStep: number, jobName: string): { id: string; content: string } {
  const occupied = new Set<string>();
  for (const line of lines) {
    const match = /^\s+(?:-\s+)?id:\s*([^\s#]+)/.exec(line.text);
    if (match?.[1]) occupied.add(match[1]);
  }
  let id = "tenet-tests";
  for (let suffix = 2; occupied.has(id); suffix += 1) id = `tenet-tests-${suffix}`;

  const jobsLine = lines.find((line) => /^\s*jobs:\s*$/.test(line.text));
  const jobsIndent = jobsLine ? indentationLength(jobsLine.text) : 0;
  const jobLine = lines.findIndex((line) => {
    const indent = indentationLength(line.text);
    return indent === jobsIndent + 2 && line.text.trim() === `${jobName}:`;
  });
  if (jobLine < 0) throw new Error(`Cannot locate CI job ${jobName}.`);
  const stepsLine = lines.findIndex((line, index) =>
    index > jobLine && /^\s*steps:\s*$/.test(line.text));
  if (stepsLine < 0) throw new Error(`Cannot locate steps in CI job ${jobName}.`);
  const stepStarts: number[] = [];
  const selectedSteps = lines[stepsLine];
  if (!selectedSteps) throw new Error(`Cannot locate steps in CI job ${jobName}.`);
  const stepsIndent = indentationLength(selectedSteps.text);
  for (let index = stepsLine + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) continue;
    const indent = indentationLength(line.text);
    if (line.text.trim() && indent <= stepsIndent) break;
    if (line.text.slice(indent).startsWith("- ") && indent > stepsIndent) stepStarts.push(index);
  }
  const first = stepStarts[testStep];
  if (first === undefined) throw new Error(`Cannot locate selected test step in ${jobName}.`);
  const last = stepStarts[testStep + 1] ?? lines.length;
  const existing = selectedStepId(lines, first, last);
  if (existing) return { id: existing, content: joinLines(lines) };
  const firstLine = lines[first];
  if (!firstLine) throw new Error(`Cannot locate selected test step in ${jobName}.`);
  const indent = firstLine.text.match(/^(\s*)/)?.[1] ?? "";
  const inlineRun = /^(\s*)-\s+run:\s*(.*)$/.exec(firstLine.text);
  if (inlineRun) {
    lines.splice(first, 1,
      { text: `${indent}- id: ${id}`, ending: firstLine.ending || "\n" },
      { text: `${indent}  run: ${inlineRun[2] ?? ""}`.trimEnd(), ending: firstLine.ending || "\n" });
  } else {
    lines.splice(first + 1, 0, { text: `${indent}  id: ${id}`, ending: firstLine.ending || "\n" });
  }
  return { id, content: joinLines(lines) };
}

function editReporter(source: string, jobName: string, testStep: number, runner: RunnerFact): string {
  const lines = splitLines(source);
  const { content } = synthesizeStepId(lines, testStep, jobName);
  const updated = splitLines(content);
  let seenJob = false;
  let inJob = false;
  let step = -1;
  for (let index = 0; index < updated.length; index += 1) {
    const text = updated[index]?.text ?? "";
    if (new RegExp(`^\\s{2}${jobName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*$`).test(text)) {
      inJob = true;
      seenJob = true;
      continue;
    }
    if (!inJob) continue;
    if (seenJob && /^ {2}\S/.test(text) && !text.trim().startsWith(`${jobName}:`)) inJob = false;
    if (/^\s{6}-\s/.test(text)) step += 1;
    if (step === testStep && /^\s+run:\s*/.test(text)) {
      const flags = reporterFlags(runner);
      if (!flags || text.includes(flags.trim())) break;
      const commandFlags = /\b(?:npm|pnpm)\s+(?:run\s+)?test\b|\byarn\s+test\b/i.test(text)
        ? ` -- ${flags.trim()}`
        : flags;
      const block = /^\s+run:\s*[|>](?:[-+]?[0-9]*)?\s*(?:#.*)?$/.test(text);
      if (!block) {
        updated[index]!.text = `${text}${commandFlags}`;
        break;
      }
      const runIndent = indentationLength(text);
      for (let body = index + 1; body < updated.length; body += 1) {
        const bodyText = updated[body]?.text ?? "";
        if (bodyText.trim() && indentationLength(bodyText) <= runIndent) break;
        if (reporterCommandMatches(bodyText, runner) && !bodyText.includes(flags.trim())) {
          const bodyFlags = /\b(?:npm|pnpm)\s+(?:run\s+)?test\b|\byarn\s+test\b/i.test(bodyText)
            ? ` -- ${flags.trim()}`
            : flags;
          updated[body]!.text = `${bodyText}${bodyFlags}`;
          return joinLines(updated);
        }
      }
      break;
    }
  }
  return joinLines(updated);
}

function stepEndOffset(source: string, jobName: string, testStep: number): number {
  const lines = splitLines(source);
  let offset = 0;
  let inJob = false;
  let stepsIndent = -1;
  let step = -1;
  let selectedStart = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? { text: "", ending: "" };
    const text = line.text;
    const indent = indentationLength(text);
    if (new RegExp(`^\\s{2}${jobName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*$`).test(text)) inJob = true;
    if (inJob && /^\s*steps:\s*$/.test(text)) stepsIndent = indent;
    if (stepsIndent >= 0 && indent > stepsIndent && text.slice(indent).startsWith("- ")) {
      step += 1;
      if (step === testStep) selectedStart = index;
      if (selectedStart >= 0 && step > testStep) return offset;
    }
    if (selectedStart >= 0 && stepsIndent >= 0 && text.trim() && indent <= stepsIndent) return offset;
    offset += text.length + line.ending.length;
  }
  if (selectedStart < 0) throw new Error(`Cannot locate selected test step in ${jobName}.`);
  return source.length;
}

function existingCiBlock(
  source: string,
  preflight: PreflightResult,
  version: string,
  template: string,
  acceptsReporterEdit: boolean,
): ManagedBlock {
  const selected = preflight.facts.ci.selected;
  const runner = preflight.facts.runner;
  if (!selected || selected.test_step === null || !runner) throw new Error("No editable CI step was selected.");
  let edited = source;
  if (!selected.reports && acceptsReporterEdit) edited = editReporter(edited, selected.name, selected.test_step, runner);
  const lines = splitLines(edited);
  const existing = selectedStepId(lines, 0, lines.length);
  const stepResult = synthesizeStepId(lines, selected.test_step, selected.name);
  edited = stepResult.content;
  const id = stepResult.id || existing || "tenet-tests";
  const body = workflowTemplate(template, { version, locked: version, id });
  const current = edited;
  const range = current.indexOf("# tenet:begin v");
  const markerEnd = current.indexOf("# tenet:end", range);
  if (range >= 0 && markerEnd >= 0) {
    const endLine = current.indexOf("\n", markerEnd);
    const end = endLine < 0 ? current.length : endLine + 1;
    const lineStart = current.lastIndexOf("\n", Math.max(0, range - 1)) + 1;
    const indentation = indentationAt(current, range);
    return {
      replacement: body,
      target: `${current.slice(0, lineStart)}${indentBlock(body, indentation)}${current.slice(end)}`,
      previous: current.slice(lineStart, end),
      prefixSep: "",
    };
  }
  const insertion = stepEndOffset(edited, selected.name, selected.test_step);
  const indentation = stepIndentation(edited, insertion);
  const inserted = indentBlock(body, indentation);
  const prefix = insertion > 0 && !edited.slice(0, insertion).endsWith("\n") ? "\n" : "";
  return {
    replacement: inserted,
    target: `${edited.slice(0, insertion)}${prefix}${inserted}${edited.slice(insertion)}`,
    previous: null,
    prefixSep: prefix,
  };
}

function stepIndentation(source: string, offset: number): string {
  const prefix = source.slice(0, offset);
  const match = /(?:^|\n)([ \t]*)-\s[^\n]*\n?$/.exec(prefix);
  return match?.[1] ?? "      ";
}

function indentationAt(source: string, offset: number): string {
  const lineStart = source.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  return source.slice(lineStart, offset).match(/^\s*/)?.[0] ?? "";
}

function indentBlock(source: string, indentation: string): string {
  return `${source.trimEnd().split(/\r?\n/).map((line) => `${indentation}${line}`).join("\n")}\n`;
}

function mcpValue(version: string, packageName: string, local: boolean): Record<string, unknown> {
  const executable = ["-y", `${packageName}@${version}`, "mcp"];
  if (local) return { command: "cmd", args: ["/c", "npx", ...executable] };
  return { command: "npx", args: executable };
}

async function managedManifest(cwd: string): Promise<InstallManifest | null> {
  const filename = await confine(".tenet/manifest.json", cwd).catch((error) => {
    if ((error as { code?: string }).code === "TN-PATH-ESCAPE") pathError(".tenet/manifest.json");
    throw error;
  });
  try {
    return JSON.parse(await readFile(filename, "utf8")) as InstallManifest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function managedLocalManifest(cwd: string): Promise<LocalManifest | null> {
  const filename = await confine(".tenet/manifest.local.json", cwd);
  try {
    return JSON.parse(await readFile(filename, "utf8")) as LocalManifest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function fileForWrite(
  cwd: string,
  itemPath: string,
  absolute = false,
): Promise<{ filename: string; state: FileState }> {
  let filename: string;
  if (absolute) filename = itemPath;
  else filename = await confine(itemPath, cwd).catch((error) => {
    if ((error as { code?: string }).code === "TN-PATH-ESCAPE") pathError(itemPath);
    throw error;
  });
  return { filename, state: await fileState(filename) };
}

function reusedBlock(
  existing: InstallManifest | null,
  path: string,
): ManifestBlock | undefined {
  return existing?.blocks.find((item) => item.path === path);
}

function reusedKey(existing: InstallManifest | null, itemPath: string, pointer: string): ManifestKey | undefined {
  return existing?.keys.find((item) => item.path === itemPath && item.pointer === pointer);
}

async function validateLocalPath(itemPath: string, localProfileRoot: string | undefined): Promise<string> {
  if (!localProfileRoot) pathError(itemPath);
  const root = path.resolve(localProfileRoot);
  const target = path.resolve(itemPath);
  const relative = path.relative(root, target);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    pathError(itemPath);
  }
  try {
    return await confine(relative.replaceAll("\\", "/"), root);
  } catch {
    pathError(itemPath);
  }
}

function buildPolicy(preflight: PreflightResult, setup: string[], reportPath: string | null, version: string, vendor: boolean, packageName: string): string {
  const defaults: Record<string, unknown> = {
    standard: "~0.1",
    ...(vendor ? { kit_path: ".tenet/kit" } : {}),
    paths: { records: "tenet" },
    level: "observe",
    specs: {
      id_prefix: "R",
      documents: [
        { path: "tenet/vision.md", level: "L0" },
        { path: "tenet/specs/prd.md", level: "L1" },
        { path: "tenet/specs/tech-spec.md", level: "L2" },
        { path: "tenet/specs/ux-spec.md", level: "L2" },
        { path: "tenet/specs/plan.md", level: "L2" },
      ],
    },
    ...(preflight.facts.owners.length > 0 ? { owners: preflight.facts.owners } : {}),
    checks: {
      test: {
        setup,
        run: preflight.facts.runner?.command ?? "npm test",
        report: preflight.facts.runner?.report ?? "none",
        report_from: preflight.facts.runner?.report_from ?? "file",
        ...(reportPath ? { report_path: reportPath } : {}),
      },
    },
    ...(preflight.plan?.ci_mode === "none" ? {} : {
      ci: {
        mode: preflight.plan?.ci_mode === "existing-ci" ? "existing-job" : "tenet-workflow",
        test_workflow: preflight.plan?.ci_mode === "existing-ci"
          ? preflight.facts.ci.selected?.workflow ?? ".github/workflows/tenet-tests.yml"
          : ".github/workflows/tenet-tests.yml",
      },
    }),
    stop: { failing_evaluations: 3 },
    agents: { working_rules: "default" },
    protect: [
      ".github/workflows/tenet.yml",
      ".github/workflows/tenet-tests.yml",
      "tenet.yaml",
      "tenet.lock",
      "CODEOWNERS",
    ],
  };
  void version;
  void packageName;
  return `${stringify(defaults, { indent: 2, lineWidth: 0 }).replace(/\r\n/g, "\n").trimEnd()}\n`;
}

export async function planWriteSet(
  input: PreflightResult | WritePlanOptions = {},
  supplied: WritePlanOptions = {},
): Promise<WriteSet> {
  const preflight = "facts" in input ? input : await runPreflight(input);
  const options = "facts" in input ? supplied : input;
  if (!preflight.plan || preflight.diagnostics.length > 0) {
    throw Object.assign(new Error(preflight.diagnostics[0]?.message ?? "Install preflight failed."), {
      finding: preflight.diagnostics[0],
    });
  }
  const cwd = path.resolve(options.cwd ?? preflight.facts.repository.cwd);
  const plan = clonePlan(preflight.plan);
  const releaseInfo = release(options);
  const kitPath = path.resolve(options.environment?.kitPath ?? installedKitPath());
  const allKitFiles = await kitFiles(kitPath);
  const digest = await kitDigest(allKitFiles);
  if (options.vendor) {
    for (const file of allKitFiles) plan.created.push(`.tenet/kit/${file.path}`);
  }
  plan.created = [...new Set(plan.created)].sort(compareUtf16);
  plan.blocks.sort((left, right) => compareUtf16(left.path, right.path) || compareUtf16(left.kind, right.kind));
  plan.keys.sort((left, right) => compareUtf16(left.path, right.path) || compareUtf16(left.pointer, right.pointer));
  plan.local_keys.sort((left, right) =>
    compareUtf16(left.path, right.path) || compareUtf16(left.pointer, right.pointer) || compareUtf16(left.host, right.host));
  const priorManifest = await managedManifest(cwd);
  const priorLocalManifest = await managedLocalManifest(cwd);
  const files = new Map<string, PlannedFile>();
  files.set("tenet.lock", {
    path: "tenet.lock",
    content: jsonFile({
      schema_version: 1,
      package: releaseInfo.package,
      version: releaseInfo.version,
      integrity: releaseInfo.integrity,
      kit_sha256: digest,
    }),
  });
  const selected = preflight.facts.ci.selected;
  const reportPath = selected?.reports
    ? selected.report_path
    : preflight.facts.runner?.report_path ?? null;
  const setup = selected && selected.test_step !== null
    ? selected.setup
    : preflight.facts.runner?.package_manager_setup ?? [];
  files.set("tenet.yaml", {
    path: "tenet.yaml",
    content: buildPolicy(
      preflight,
      setup,
      reportPath,
      releaseInfo.version,
      options.vendor === true,
      releaseInfo.package,
    ),
  });
  if (preflight.facts.repository.empty) {
    const template = await readFile(path.join(kitPath, "templates", "intent.md"), "utf8");
    const project = path.basename(cwd);
    const owner = preflight.facts.owners[0]?.name ?? "Project Owner";
    const purpose = preflight.facts.purpose ?? "Undecided · edit or run tenet onboard";
    files.set("tenet/intent.md", {
      path: "tenet/intent.md",
      content: template
        .replaceAll("<owner>", owner)
        .replaceAll("<Project>", project)
        .replace("Checkout recovers cleanly from transient gateway timeouts for returning shoppers.",
          purpose)
        .replace(/\r\n/g, "\n")
        .replace(/\n+$/, "") + "\n",
    });
  }
  if (options.vendor) {
    for (const file of allKitFiles) files.set(`.tenet/kit/${file.path}`, {
      path: `.tenet/kit/${file.path}`,
      content: file.content,
    });
  }
  for (const skill of ["draft-specs", "review-with-findings", "work-a-change"]) {
    const content = await readFile(path.join(kitPath, "skills", skill, "SKILL.md"), "utf8");
    for (const prefix of [".agents/skills", ...(plan.hosts.some((host) => host.id === "claude") ? [".claude/skills"] : [])]) {
      const itemPath = `${prefix}/tenet-${skill}/SKILL.md`;
      if (plan.created.includes(itemPath)) files.set(itemPath, { path: itemPath, content: `${content.replace(/\r\n/g, "\n").replace(/\n+$/, "")}\n` });
    }
  }
  const toolchain = await toolchainBindings(cwd, preflight.facts.runner);
  const workflowBindings = {
    locked: releaseInfo.version,
    version: releaseInfo.version,
    "default branch": preflight.facts.repository.branch ?? "main",
  };
  if (preflight.facts.repository.forge === "github") {
    let testWorkflowName = "Tenet tests";
    if (plan.ci_mode === "tenet-workflow") {
      const source = await readFile(path.join(kitPath, "workflows", "tenet-tests.yml"), "utf8");
      const content = workflowTemplate(
        source.replace("      # <toolchain step>", toolchain["toolchain step"] ?? ""),
        workflowBindings,
      )
        .replace('node-version: "22"', `node-version: ${JSON.stringify(toolchain["node version"] ?? "22")}`)
        .replace(/\n{3,}/g, "\n\n");
      files.set(".github/workflows/tenet-tests.yml", { path: ".github/workflows/tenet-tests.yml", content });
      testWorkflowName = gitHubWorkflowName(content, "Tenet tests");
    } else if (selected) {
      const existing = await readFile(path.join(cwd, ...selected.workflow.split("/")), "utf8");
      testWorkflowName = gitHubWorkflowName(existing, selected.workflow);
    }
    const recorder = await readFile(path.join(kitPath, "workflows", "tenet.yml"), "utf8");
    files.set(".github/workflows/tenet.yml", {
      path: ".github/workflows/tenet.yml",
      content: workflowTemplate(recorder, { ...workflowBindings, "test workflow name": testWorkflowName }),
    });
  }
  for (const itemPath of plan.created) {
    if (itemPath === ".tenet/manifest.json" ||
      itemPath === ".tenet/manifest.local.json") continue;
    if (!files.has(itemPath)) throw new Error(`No content was planned for ${itemPath}.`);
  }

  const writes: PendingWrite[] = [];
  const manifest: InstallManifest = {
    schema_version: 1,
    version: releaseInfo.version,
    created: [],
    blocks: [],
    keys: [],
  };
  let writeIndex = 0;
  const resolvedProfileRoots = localProfileRoots(options.environment);
  const localWrites: PendingWrite[] = [];
  const localKeys: LocalManifestKey[] = [];
  for (const key of plan.local_keys) {
    const resolvedProfileRoot = resolvedProfileRoots?.[key.host] ??
      localProfileRoot(options.environment);
    const filename = await validateLocalPath(key.path, resolvedProfileRoot);
    const { state } = await fileForWrite(cwd, filename, true);
    const root = state.text === null ? {} : decodeJson(state.text);
    const previous = pointerValue(root, key.pointer);
    const installed = mcpValue(releaseInfo.version, releaseInfo.package, true);
    setPointer(root, key.pointer, installed);
    const content = state.text === null
      ? jsonFile(root)
      : setJsonPointerBytes(state.text, key.pointer, installed);
    const prior = priorLocalManifest?.keys.find((item) =>
      item.host === key.host && item.path === key.path && item.pointer === key.pointer);
    const installedAlready = prior !== undefined &&
      state.text !== null &&
      (JSON.stringify(previous) === JSON.stringify(prior.installed) ||
        JSON.stringify(previous) === JSON.stringify(installed));
    localKeys.push({
      ...key,
      previous: installedAlready ? prior.previous : previous ?? null,
      installed,
      ...(installedAlready
        ? prior.previous_raw !== undefined ? { previous_raw: prior.previous_raw } : {}
        : state.text !== null ? { previous_raw: state.text } : {}),
    });
    const finalContent = state.text !== null && isDeepStrictEqual(previous, installed)
      ? state.text
      : content;
    localWrites.push({
      id: `local_key:${String(++writeIndex).padStart(3, "0")}:${key.host}:${key.path}:${key.pointer}`,
      kind: "local_key",
      path: filename,
      pointer: key.pointer,
      ...(resolvedProfileRoot ? { profile_root: resolvedProfileRoot } : {}),
      before_sha256: state.sha256,
      after_sha256: sha256Bytes(Buffer.from(finalContent, "utf8")),
      content: finalContent,
    });
  }
  if (plan.local_keys.length > 0) {
    const roots = Object.fromEntries(plan.local_keys.map(({ host, path: itemPath }) => {
      const root = resolvedProfileRoots?.[host] ?? localProfileRoot(options.environment);
      if (!root) pathError(itemPath);
      return [host, root];
    }));
    files.set(".tenet/manifest.local.json", {
      path: ".tenet/manifest.local.json",
      content: localManifestJson({
        schema_version: 1,
        profile_roots: roots,
        keys: localKeys,
      }),
    });
  }
  for (const itemPath of plan.created) {
    if (itemPath === ".tenet/manifest.json") continue;
    const planned = files.get(itemPath);
    if (!planned) throw new Error(`No content was planned for ${itemPath}.`);
    const { state } = await fileForWrite(cwd, itemPath);
    const after = sha256Bytes(Buffer.from(planned.content, "utf8"));
    if (state.exists && state.sha256 !== after && !options.force) throw installError("TN-INIT-EXISTS", itemPath);
    writes.push({
      id: `file:${String(++writeIndex).padStart(3, "0")}:${itemPath}`,
      kind: "file",
      path: itemPath,
      before_sha256: state.sha256,
      after_sha256: after,
      content: planned.content,
    });
    manifest.created.push({ path: itemPath, sha256: after });
  }

  const managedPaths = [...new Set(plan.created.concat(
    plan.blocks.map((block) => block.path),
    plan.keys.map((key) => key.path),
  ))].sort(compareUtf16);
  for (const block of plan.blocks) {
    const { state } = await fileForWrite(cwd, block.path);
    const source = state.text ?? "";
    let managed: ManagedBlock;
    if (block.path === "AGENTS.md") {
      const replacement = await agentsBlock(kitPath, releaseInfo.version, preflight.facts.runner);
      const result = replaceBlock(source, block.kind, replacement.trimEnd() + "\n");
      managed = { replacement, target: result.content, previous: result.previous, prefixSep: result.prefixSep };
    } else if (block.path === ".gitignore") {
      const replacement = ignoreBlock(releaseInfo.version);
      const result = replaceBlock(source, block.kind, replacement.trimEnd() + "\n");
      managed = { replacement, target: result.content, previous: result.previous, prefixSep: result.prefixSep };
    } else if (block.path === ".gitattributes") {
      const replacement = attributesBlock(releaseInfo.version, managedPaths);
      const result = replaceBlock(source, block.kind, replacement.trimEnd() + "\n");
      managed = { replacement, target: result.content, previous: result.previous, prefixSep: result.prefixSep };
    } else if (block.path === ".github/pull_request_template.md") {
      const replacement = await pullRequestBlock(kitPath, releaseInfo.version);
      if (state.text === null) {
        managed = {
          replacement,
          target: await pullRequestTemplate(kitPath, releaseInfo.version),
          previous: null,
          prefixSep: "",
        };
      } else {
        const result = replaceBlock(source, block.kind, replacement);
        managed = { replacement, target: result.content, previous: result.previous, prefixSep: result.prefixSep };
      }
    } else if (
      block.path === "CLAUDE.md" ||
      block.path === ".github/copilot-instructions.md"
    ) {
      const replacement = hostPointerBlock(releaseInfo.version);
      const result = replaceBlock(source, block.kind, replacement.trimEnd() + "\n");
      managed = { replacement, target: result.content, previous: result.previous, prefixSep: result.prefixSep };
    } else if (block.path === preflight.facts.ci.selected?.workflow && plan.ci_mode === "existing-ci") {
      const template = await readFile(path.join(kitPath, "workflows", "existing-ci-step.yml"), "utf8");
      managed = existingCiBlock(
        source,
        preflight,
        releaseInfo.version,
        template,
        options.answers?.allowReporterEdit === true,
      );
      void managed.replacement;
    } else {
      throw new Error(`No block content was planned for ${block.path}.`);
    }
    const previousMetadata = reusedBlock(priorManifest, block.path);
    const priorCreated = priorManifest?.created.find((item) => item.path === block.path);
    const currentIsInstalled = previousMetadata !== undefined &&
      source === managed.target;
    if (state.text === null || priorCreated) {
      const created = { path: block.path, sha256: sha256Bytes(Buffer.from(managed.target, "utf8")) };
      manifest.created = manifest.created.filter((item) => item.path !== block.path);
      manifest.created.push(created);
    }
    manifest.blocks.push({
      path: block.path,
      kind: block.kind,
      marker: blockMarker(block.kind, releaseInfo.version),
      previous_existed: currentIsInstalled
        ? previousMetadata.previous_existed ?? state.exists
        : state.exists,
      previous_block: currentIsInstalled ? previousMetadata.previous_block ?? null : managed.previous,
      prefix_sep: currentIsInstalled ? previousMetadata.prefix_sep ?? "" : managed.prefixSep,
    });
    writes.push({
      id: `block:${String(++writeIndex).padStart(3, "0")}:${block.path}`,
      kind: "block",
      path: block.path,
      before_sha256: state.sha256,
      after_sha256: sha256Bytes(Buffer.from(managed.target, "utf8")),
      content: managed.target,
    });
  }

  for (const key of plan.keys) {
    const { state } = await fileForWrite(cwd, key.path);
    const root = state.text === null ? {} : decodeJson(state.text);
    const previous = pointerValue(root, key.pointer);
    const installed = mcpValue(releaseInfo.version, releaseInfo.package, false);
    setPointer(root, key.pointer, installed);
    const content = state.text === null
      ? jsonFile(root)
      : setJsonPointerBytes(state.text, key.pointer, installed);
    const prior = reusedKey(priorManifest, key.path, key.pointer);
    const installedAlready = prior !== undefined &&
      state.text !== null &&
      (JSON.stringify(previous) === JSON.stringify(prior.installed) ||
        JSON.stringify(previous) === JSON.stringify(installed));
    const metadata: ManifestKey = {
      path: key.path,
      pointer: key.pointer,
      previous: installedAlready ? prior.previous : previous ?? null,
      installed,
      ...(installedAlready
        ? prior.previous_raw !== undefined ? { previous_raw: prior.previous_raw } : {}
        : state.text !== null ? { previous_raw: state.text } : {}),
    };
    manifest.keys.push(metadata);
    const contentUnchanged = state.text !== null && isDeepStrictEqual(previous, installed);
    const finalContent = contentUnchanged ? state.text ?? content : content;
    writes.push({
      id: `key:${String(++writeIndex).padStart(3, "0")}:${key.path}:${key.pointer}`,
      kind: "key",
      path: key.path,
      pointer: key.pointer,
      before_sha256: state.sha256,
      after_sha256: sha256Bytes(Buffer.from(finalContent, "utf8")),
      content: finalContent,
    });
  }

  writes.push(...localWrites);

  manifest.created.sort((left, right) => compareUtf16(left.path, right.path));
  manifest.blocks.sort((left, right) => compareUtf16(left.path, right.path));
  manifest.keys.sort((left, right) =>
    compareUtf16(left.path, right.path) || compareUtf16(left.pointer, right.pointer));

  const targetManifest = manifestJson(manifest);
  const finalManifestPath = await confine(".tenet/manifest.json", cwd).catch((error) => {
    if ((error as { code?: string }).code === "TN-PATH-ESCAPE") pathError(".tenet/manifest.json");
    throw error;
  });
  const manifestState = await fileState(finalManifestPath);
  if (manifestState.exists && manifestState.text !== targetManifest && !options.force) {
    const existing = priorManifest;
    if (!existing ||
      existing.version !== manifest.version ||
      manifestState.text !== manifestJson(existing)) {
      throw installError("TN-INIT-EXISTS", ".tenet/manifest.json");
    }
  }
  return {
    cwd,
    version: releaseInfo.version,
    plan,
    writes,
    manifest,
    ...(options.environment?.localProfileRoot
      ? { localProfileRoot: options.environment.localProfileRoot }
      : {}),
  };
}

async function confinedWritePath(write: PendingWrite, plan: WriteSet, pending: PendingManifest): Promise<string> {
  if (write.kind === "local_key") {
    const root = write.profile_root ?? plan.localProfileRoot;
    if (!root) pathError(write.path);
    return validateLocalPath(write.path, root);
  }
  void pending;
  return confine(write.path, plan.cwd).catch((error) => {
    if ((error as { code?: string }).code === "TN-PATH-ESCAPE") pathError(write.path);
    throw error;
  });
}

function wroteItem(plan: WriteSet, write: PendingWrite): keyof InitWrote | "none" {
  if (write.kind === "file") return "created";
  if (write.kind === "block") return "blocks";
  if (write.kind === "key") return "keys";
  if (write.kind === "local_key") return "local_keys";
  return "none";
}

function recordWrote(plan: WriteSet, write: PendingWrite, wrote: InitWrote): void {
  const kind = wroteItem(plan, write);
  if (kind === "created") wrote.created.push(write.path);
  else if (kind === "blocks") {
    const planned = plan.plan.blocks.find((item) => item.path === write.path);
    if (planned) wrote.blocks.push({ ...planned });
  } else if (kind === "keys") {
    const planned = plan.plan.keys.find((item) => item.path === write.path && item.pointer === write.pointer);
    if (planned) wrote.keys.push({ ...planned });
  } else if (kind === "local_keys") {
    const planned = plan.plan.local_keys.find((item) =>
      item.path.replaceAll("\\", "/") === write.path.replaceAll("\\", "/") &&
      item.pointer === write.pointer);
    if (planned) wrote.local_keys.push({ ...planned });
  }
}

function sortWrote(wrote: InitWrote): void {
  wrote.created.sort(compareUtf16);
  wrote.blocks.sort((left, right) => compareUtf16(left.path, right.path));
  wrote.keys.sort((left, right) => compareUtf16(left.path, right.path) || compareUtf16(left.pointer, right.pointer));
  wrote.local_keys.sort((left, right) =>
    compareUtf16(left.path, right.path) || compareUtf16(left.pointer, right.pointer));
}

function interrupted(after: ApplyPlanOptions["fault"], checkpoint: "pending" | string | number, index: number): void {
  const expected = after?.after;
  if (
    expected === checkpoint ||
    (typeof expected === "number" && expected === index)
  ) {
    throw Object.assign(new Error(`Injected install interruption after ${String(checkpoint)}.`), {
      code: "INSTALL_INTERRUPTED",
    });
  }
}

function emptyWrote(): InitWrote {
  return { created: [], blocks: [], keys: [], local_keys: [] };
}

export async function applyPlan(
  plan: WriteSet,
  options: ApplyPlanOptions = {},
): Promise<InitResult> {
  const effective: WriteSet = {
    ...plan,
    ...(options.localProfileRoot ? { localProfileRoot: options.localProfileRoot } : {}),
  };
  const pending: PendingManifest = {
    schema_version: 1,
    version: plan.version,
    writes: plan.writes,
    manifest: plan.manifest,
    ...(plan.upgrade ? { upgrade: structuredClone(plan.upgrade) } : {}),
  };
  const pendingPath = await confine(".tenet/manifest.pending.json", plan.cwd);
  const currentPending = await fileState(pendingPath);
  if (currentPending.exists) {
    throw installError("TN-INIT-EXISTS", ".tenet/manifest.pending.json");
  }
  for (const write of pending.writes) await confinedWritePath(write, effective, pending);
  await writeAtomic(pendingPath, pendingJson(pending));
  interrupted(options.fault, "pending", 0);
  const wrote = emptyWrote();
  for (let index = 0; index < pending.writes.length; index += 1) {
    const write = pending.writes[index];
    if (!write || write.content === undefined) throw new Error(`Pending write ${write?.id ?? index} has no content.`);
    const filename = await confinedWritePath(write, effective, pending);
    const state = await fileState(filename);
    if (state.sha256 === write.after_sha256) {
      continue;
    }
    if (state.sha256 !== write.before_sha256) throw installError("TN-INIT-EXISTS", write.path);
    await writeAtomic(filename, write.content);
    recordWrote(effective, write, wrote);
    interrupted(options.fault, write.id, index + 1);
  }
  const manifestPath = await confine(".tenet/manifest.json", plan.cwd);
  const manifestContent = manifestJson(pending.manifest);
  const oldManifest = await fileState(manifestPath);
  if (!oldManifest.exists || oldManifest.text !== manifestContent) {
    await writeAtomic(manifestPath, manifestContent);
  }
  wrote.created.push(".tenet/manifest.json");
  await rm(pendingPath, { force: true });
  sortWrote(wrote);
  return {
    plan: plan.plan,
    wrote,
    findings: [],
  };
}

export async function resumePendingPlan(
  cwd: string,
  preflight: PreflightResult,
  options: ApplyPlanOptions = {},
): Promise<InitResult | null> {
  const pendingPath = await confine(".tenet/manifest.pending.json", cwd);
  const pending = await readPendingPlan(cwd, options.localProfileRoot);
  if (!pending) return null;
  const fallback = preflight.plan ?? {
    created: [],
    blocks: [],
    keys: [],
    local_keys: [],
    hosts: [],
    ci_mode: "none",
    ci_reason: "",
  };
  const plan: WriteSet = {
    cwd,
    version: pending.version,
    plan: {
      created: pending.manifest.created.map((item) => item.path).concat(".tenet/manifest.json").sort(compareUtf16),
      blocks: pending.manifest.blocks.map(({ path, kind }) => ({ path, kind })),
      keys: pending.manifest.keys.map(({ path, pointer }) => ({ path, pointer })),
      local_keys: fallback.local_keys,
      hosts: fallback.hosts,
      ci_mode: fallback.ci_mode,
      ci_reason: fallback.ci_reason,
    },
    writes: pending.writes,
    manifest: pending.manifest,
    ...(pending.upgrade ? { upgrade: pending.upgrade } : {}),
    ...(options.localProfileRoot ? { localProfileRoot: options.localProfileRoot } : {}),
  };
  for (const write of pending.writes) await confinedWritePath(write, plan, pending);
  const wrote = emptyWrote();
  for (let index = 0; index < pending.writes.length; index += 1) {
    const write = pending.writes[index];
    if (!write || write.content === undefined) throw new Error(`Pending write ${write?.id ?? index} has no content.`);
    const filename = await confinedWritePath(write, plan, pending);
    const current = await fileState(filename);
    if (current.sha256 === write.after_sha256) continue;
    if (current.sha256 !== write.before_sha256) throw installError("TN-INIT-EXISTS", write.path);
    await writeAtomic(filename, write.content);
    recordWrote(plan, write, wrote);
    interrupted(options.fault, write.id, index + 1);
  }
  const manifestPath = await confine(".tenet/manifest.json", cwd);
  const manifestContent = manifestJson(pending.manifest);
  await writeAtomic(manifestPath, manifestContent);
  wrote.created.push(".tenet/manifest.json");
  await rm(pendingPath, { force: true });
  sortWrote(wrote);
  return { plan: plan.plan, wrote, findings: [] };
}

export async function readPendingPlan(
  cwd: string,
  localProfileRoot?: string,
): Promise<PendingManifest | null> {
  const pendingPath = await confine(".tenet/manifest.pending.json", cwd);
  const state = await fileState(pendingPath);
  if (!state.text) return null;
  const pending = JSON.parse(state.text) as PendingManifest;
  const placeholder: WriteSet = {
    cwd,
    version: pending.version,
    plan: {
      created: [],
      blocks: [],
      keys: [],
      local_keys: [],
      hosts: [],
      ci_mode: "none",
      ci_reason: "",
    },
    writes: pending.writes,
    manifest: pending.manifest,
    ...(pending.upgrade ? { upgrade: pending.upgrade } : {}),
    ...(localProfileRoot ? { localProfileRoot } : {}),
  };
  for (const item of pending.manifest.created) {
    await confine(item.path, cwd).catch(() => pathError(item.path));
  }
  for (const item of pending.manifest.blocks) {
    await confine(item.path, cwd).catch(() => pathError(item.path));
  }
  for (const item of pending.manifest.keys) {
    await confine(item.path, cwd).catch(() => pathError(item.path));
  }
  for (const write of pending.writes) {
    await confinedWritePath(write, placeholder, pending);
  }
  return pending;
}
