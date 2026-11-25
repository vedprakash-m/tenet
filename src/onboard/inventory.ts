/// <reference path="../policy/picomatch.d.ts" />
import path from "node:path";
import picomatch from "picomatch";
import { parse as parseYaml } from "yaml";
import { sha256 } from "../core/hash.js";
import type { Assignment, Inventory, TenetYaml } from "../types/generated.js";
import type { RepositorySnapshot, TrackedFile } from "./preflight.js";

export const views: Assignment["views"] = ["vision", "requirements", "design", "experience", "plan"];
export type Layout = Inventory["layout"];
type Kind = Inventory["sources"]["files"][number]["kind"];
type Skip = "env" | "credentials" | "vendored" | "generated" | "excluded" | "binary" | "oversize";
type Owner = Inventory["owners"][number];

export type InventorySource = Inventory["sources"]["files"][number] & { text: string };
export type Facts = {
  snapshot: RepositorySnapshot;
  policy: TenetYaml;
  files: InventorySource[];
  codeowners: string | undefined;
  project: string;
  inventory: Omit<Inventory, "tests" | "findings" | "observations">;
};

const byteLimit = 1_048_576;
const binaryExtensions = /\.(?:png|jpe?g|gif|webp|ico|pdf|zip|tar|gz|wasm|exe|dll|so|dylib)$/i;
const languages: Readonly<Record<string, string>> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  mjs: "javascript", cjs: "javascript", py: "python", go: "go", rs: "rust",
  java: "java", kt: "kotlin", cs: "csharp", rb: "ruby", php: "php", swift: "swift",
  c: "c", cc: "cpp", cpp: "cpp", h: "c", hpp: "cpp", scala: "scala",
};
const manifests = new Set(["package.json", "pyproject.toml", "setup.py", "setup.cfg", "go.mod",
  "Cargo.toml", "pom.xml", "build.gradle", "build.gradle.kts", "Gemfile", "composer.json", "Package.swift"]);
const tests = /(?:\.(?:test|spec)\.(?:tsx?|jsx?|mjs|cjs)$|(?:^|\/)test_[^/]*\.py$|_test\.(?:py|go)$|Test\.java$|(?:^|\/)tests\/.*\.rs$)/;
const workflowFile = /^(?:\.github\/workflows\/.*\.ya?ml|\.gitlab-ci\.ya?ml|\.circleci\/config\.ya?ml|azure-pipelines\.ya?ml)$/i;

export function ascii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function language(file: string): string | undefined {
  const extension = path.posix.extname(file).slice(1);
  return Object.hasOwn(languages, extension) ? languages[extension] : undefined;
}

function earlySkip(file: string): Skip | undefined {
  const base = path.posix.basename(file);
  if (/^\.env(?:\.|$)/.test(base)) return "env";
  if (/\.(?:pem|key)$|^id_|credentials|secret/i.test(base)) return "credentials";
  if (/(?:^|\/)(?:vendor|node_modules|dist|build)\//.test(file)) return "vendored";
  return undefined;
}

function generatedRules(blobs: Map<string, Buffer>): Array<{ match: (file: string) => boolean; generated: boolean }> {
  const rules = [];
  for (const [file, bytes] of [...blobs].sort(([left], [right]) => (left.split("/").length - right.split("/").length) || ascii(left, right))) {
    const directory = path.posix.dirname(file);
    const prefix = directory === "." ? "" : `${directory}/`;
    for (const line of bytes.toString("utf8").split(/\r?\n/)) {
      const [raw, ...attributes] = line.trim().split(/\s+/);
      if (!raw || raw.startsWith("#") || raw.startsWith("!") || raw.endsWith("/")) continue;
      const attribute = attributes.findLast((value) => /^(?:[-!])?linguist-generated(?:=.+)?$/.test(value));
      if (!attribute) continue;
      const pattern = raw.replace(/^\//, "");
      const matcher = picomatch(pattern.includes("/") || raw.startsWith("/") ? pattern : `**/${pattern}`, { dot: true });
      rules.push({
        match: (candidate: string) => candidate.startsWith(prefix) && matcher(candidate.slice(prefix.length)),
        generated: !/^(?:[-!])|=false$/.test(attribute),
      });
    }
  }
  return rules;
}

function installedFiles(blobs: Map<string, Buffer>): Map<string, string> {
  const manifest = object(parsed(blobs.get(".tenet/manifest.json")?.toString("utf8") ?? ""));
  const created = new Map<string, string>();
  if (manifest.schema_version !== 1 || !Array.isArray(manifest.created)) return created;
  for (const entry of manifest.created) {
    const { path: filename, sha256: digest } = object(entry);
    if (typeof filename === "string" && typeof digest === "string") created.set(filename, digest);
  }
  return created;
}

function kindFor(file: string, text: string, installed: boolean): Kind {
  const base = path.posix.basename(file);
  if (base === "AGENTS.md") {
    if (text.replace(/<!-- tenet:begin(?: v[^\s]+)? -->[\s\S]*?<!-- tenet:end -->/g, "").trim()) return "instructions";
    return "config";
  }
  // The seed intent remains a specification. Unchanged install-owned Markdown is setup, not project guidance.
  if (file !== "tenet/intent.md" && (
      /(?:^|\/)(?:\.agents|\.claude)\/skills\/tenet-[^/]+\/SKILL\.md$/.test(file) ||
      (installed && /\.mdx?$/i.test(file)))) return "config";
  if (["CLAUDE.md", "GEMINI.md", ".windsurfrules"].includes(base) ||
      file === ".github/copilot-instructions.md" || file.startsWith(".cursor/rules/")) return "instructions";
  if (workflowFile.test(file)) return "ci";
  if (manifests.has(base)) return "manifest";
  if (tests.test(file)) return "test";
  if (/\.mdx?$/i.test(file)) return /(?:^|\/)adrs?\//i.test(file) ? "adr" : "doc";
  return language(file) ? "source" : "config";
}

async function collect(snapshot: RepositorySnapshot, policy: TenetYaml): Promise<{ files: InventorySource[]; skipped: Inventory["sources"]["skipped"] }> {
  const tracked = snapshot.files.slice().sort((left, right) => ascii(left.path, right.path));
  const early = new Map<string, Skip>();
  const eligible: TrackedFile[] = [];
  for (const file of tracked) {
    const reason = earlySkip(file.path);
    if (reason) early.set(file.path, reason);
    else if (file.regular) eligible.push(file);
  }
  const { blobs, generatedHeaders } = await snapshot.read(eligible, byteLimit);
  const attrs = new Map([...blobs].filter(([name]) => path.posix.basename(name) === ".gitattributes"));
  const rules = generatedRules(attrs);
  const excluded = (policy.onboard?.exclude ?? []).map((pattern) => picomatch(pattern, { dot: true }));
  const skipped: Inventory["sources"]["skipped"] = [];
  const retained: TrackedFile[] = [];
  for (const file of tracked) {
    const head = blobs.get(file.path);
    const text = head?.toString("utf8") ?? "";
    const generated = generatedHeaders.has(file.path) || rules.findLast((rule) => rule.match(file.path))?.generated ||
      /Code generated|@generated/.test(text.split(/\r?\n/, 5).join("\n"));
    const reason = early.get(file.path) ??
      (generated ? "generated" : undefined) ??
      (excluded.some((match) => match(file.path)) ? "excluded" : undefined) ??
      (!file.regular || binaryExtensions.test(file.path) || head?.subarray(0, 8192).includes(0) ? "binary" : undefined) ??
      (file.size > byteLimit ? "oversize" : undefined);
    if (reason) skipped.push({ path: file.path, reason });
    else retained.push(file);
  }
  const installed = installedFiles(blobs);
  const files = retained.map(({ path: filename }) => {
    const bytes = blobs.get(filename) ?? Buffer.alloc(0);
    const text = bytes.toString("utf8");
    const lines = text ? text.split("\n").length - Number(text.endsWith("\n")) : 0;
    const digest = sha256(bytes);
    return { path: filename, kind: kindFor(filename, text, installed.get(filename) === digest), sha256: digest, lines, text };
  });
  return { files, skipped };
}

function ownersFrom(file: InventorySource | undefined): Owner[] {
  return (file?.text ?? "").split(/\r?\n/).flatMap((line) => {
    const [pattern, ...names] = line.replace(/(?:^|\s)#.*$/, "").trim().split(/\s+/);
    return pattern ? [{ pattern, owners: names }] : [];
  });
}

export function ownerMatcher(pattern: string): (file: string) => boolean {
  const stripped = pattern.replace(/^\//, "");
  const glob = stripped.endsWith("/") ? `${stripped}**` : stripped;
  const match = picomatch(pattern.startsWith("/") || stripped.slice(0, -1).includes("/") ? glob : `**/${glob}`, { dot: true });
  return (file) => match(file) || file.split("/").slice(0, -1).some((_, i, folders) => match(folders.slice(0, i + 1).join("/")));
}

function within(root: string, file: string): boolean {
  return root === "." || root === file || file.startsWith(`${root}/`);
}

export { within };

function moduleRows(files: InventorySource[], source: InventorySource[]): Inventory["modules"] {
  const declared = files.filter((file) => file.kind === "manifest").map(({ path: filename }) => path.posix.dirname(filename));
  const roots = [...new Set(declared.length ? declared : source.map(({ path: filename }) => topFolder(filename)))].sort(ascii);
  return roots.map((root) => ({
    id: root === "." ? "root" : root.replaceAll("/", "-"),
    roots: [root],
    languages: [...new Set(source.flatMap((file) => within(root, file.path) ? language(file.path) ?? [] : []))].sort(ascii),
  }));
}

function topFolder(file: string): string {
  return file.includes("/") ? file.slice(0, file.indexOf("/")) : ".";
}

function draftingUnits(layout: Layout, owners: Owner[], source: InventorySource[]): Inventory["units"] {
  if (layout === "one-file") return [{ id: "root", paths: ["."], views: [...views] }];
  const units = owners.length ? owners.map(({ pattern }) => {
    const prefix = pattern.replace(/^[/*]+|[/*]+$/g, "") || ".";
    const match = ownerMatcher(pattern);
    return { id: prefix === "." ? "root" : prefix.replaceAll("/", "-"), paths: [prefix],
      lines: source.reduce((sum, file) => sum + (match(file.path) ? file.lines : 0), 0) };
  }) : [...new Set(source.map(({ path: filename }) => topFolder(filename)))].sort(ascii).map((root) => ({
    id: root === "." ? "root" : root,
    paths: [root], lines: source.reduce((sum, file) => sum + (topFolder(file.path) === root ? file.lines : 0), 0),
  }));
  while (units.length > 1) {
    const small = units.findIndex((unit) => unit.lines < 2000);
    if (small === -1) break;
    const target = units[small === 0 ? 1 : small - 1];
    const removed = units[small];
    if (!target || !removed) break;
    target.paths.push(...removed.paths);
    target.lines += removed.lines;
    units.splice(small, 1);
  }
  return units.map(({ id, paths }) => ({ id, paths, views: [...views] }));
}

export function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function parsed(text: string, yaml = false): unknown {
  try { return yaml ? parseYaml(text, { maxAliasCount: 50 }) : JSON.parse(text); }
  catch { return undefined; }
}

function projectKind(files: InventorySource[]): string {
  const packages = files.filter((file) => path.posix.basename(file.path) === "package.json").map((file) => object(parsed(file.text)));
  if (packages.some((pkg) => Boolean(pkg.bin)) || files.some((file) => /(?:^|\/)cmd\//.test(file.path))) return "cli";
  const server = /^(?:express|fastify|koa|hapi|@hapi\/hapi|@nestjs\/core|django|flask|fastapi|aiohttp|gin|echo|actix-web|axum)$/i;
  const service = packages.some((pkg) => Object.keys(object(pkg.dependencies)).some((name) => server.test(name))) ||
    files.some((file) => (/^Dockerfile(?:\.|$)/i.test(path.posix.basename(file.path)) && /^\s*EXPOSE\s+\S/im.test(file.text)) ||
      (file.kind === "manifest" && !file.path.endsWith("package.json") && /\b(?:django|flask|fastapi|aiohttp|actix-web|axum|gin-gonic)\b/i.test(file.text)));
  if (service) return "service";
  if (packages.some((pkg) => typeof pkg.name === "string" && typeof pkg.version === "string" && pkg.private !== true) ||
      files.some((file) => file.kind === "manifest" && /(?:^|\/)(?:pyproject\.toml|Cargo\.toml)$/.test(file.path) && /^\[(?:project|package)\]/m.test(file.text))) return "library";
  if (files.some((file) => /(?:dbt_project\.yml$|\.ipynb$|(?:^|\/)dags\/)/i.test(file.path))) return "data";
  if (files.some((file) => /(?:\.tf$|(?:^|\/)Chart\.yaml$)/.test(file.path) ||
      (/\.ya?ml$/.test(file.path) && /^apiVersion:\s*\S+/m.test(file.text) && /^kind:\s*\S+/m.test(file.text)))) return "infrastructure";
  return "application";
}

function headings(text: string): { title: string; sections: string[] } {
  let title: string | undefined;
  const sections: string[] = [];
  let fence: string | undefined;
  for (const line of text.split(/\r?\n/)) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (fence[0] === marker[0] && marker.length >= fence.length) fence = undefined;
      continue;
    }
    if (fence) continue;
    const heading = /^(#{1,2})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading?.[1] === "#") title ??= heading[2];
    if (heading?.[1] === "##") {
      const slug = (heading[2] ?? "").toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu, "").trim().replace(/\s+/g, "-");
      if (slug) sections.push(slug);
    }
  }
  return { title: title ?? "", sections };
}

function ciRows(files: InventorySource[]): Inventory["ci"] {
  return files.filter((file) => file.kind === "ci").map(({ path: filename, text }) => {
    const document = object(parsed(text, true));
    const commands: string[] = [];
    for (const job of Object.values(object(document.jobs))) {
      const steps = object(job).steps;
      for (const step of Array.isArray(steps) ? steps : []) {
        const run = object(step).run;
        if (typeof run === "string") commands.push(run.trim());
        else if (typeof object(run).command === "string") commands.push(String(object(run).command).trim());
      }
    }
    if (filename.startsWith(".gitlab-ci.")) {
      for (const job of Object.values(document)) {
        const script = object(job).script;
        if (typeof script === "string") commands.push(script.trim());
        else if (Array.isArray(script)) commands.push(...script.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()));
      }
    }
    return { path: filename, commands };
  });
}

export async function inventoryFacts(snapshot: RepositorySnapshot, policy: TenetYaml, override?: Layout): Promise<Facts> {
  const { files, skipped } = await collect(snapshot, policy);
  const source = files.filter((file) => file.kind !== "test" && language(file.path) !== undefined);
  const codeowners = [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"].map((name) => files.find((file) => file.path === name)).find(Boolean);
  const owners = ownersFrom(codeowners);
  const size = { source_lines: source.reduce((sum, file) => sum + file.lines, 0), areas: owners.length };
  const layout = override ?? (size.source_lines >= 20_000 || size.areas >= 4 ? "separate" : "one-file");
  const documents = files.filter(({ kind }) => kind === "doc" || kind === "adr");
  const dates = await snapshot.dates(documents.map(({ path: filename }) => filename));
  const docs = documents.map((file) => {
    const { title, sections } = headings(file.text);
    return { path: file.path, title: title || path.posix.basename(file.path), sections, last_changed: dates.get(file.path) ?? snapshot.revision };
  });
  return {
    snapshot, policy, files, codeowners: codeowners?.path, project: projectKind(files),
    inventory: {
      schema_version: 1,
      revision: snapshot.revision,
      sources: { files: files.map(({ text: _text, ...file }) => file), skipped },
      modules: moduleRows(files, source),
      docs,
      owners,
      ci: ciRows(files),
      size,
      layout,
      units: draftingUnits(layout, owners, source),
    },
  };
}
