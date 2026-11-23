import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import { extractTags, extractTokenTags } from "./tags.js";
import type { TestCase, TestStatus } from "./types.js";
import type { ReportReadOptions, ReportReader } from "./read-types.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: false,
  preserveOrder: true,
  processEntities: false,
  stopNodes: ["*.failure", "*.error", "*.system-out", "*.system-err", "*.flakyFailure", "*.rerunFailure"],
});

export const reportRegistry = {
  junit: (text, options) => parseJunit(text, options),
  ctrf: (text, options) => parseCtrf(text, options),
  "go-test-json": (text, options) => parseGo(text, options),
  "jest-json": (text, options) => parseJest(text, options),
  none: () => ({ cases: [], teardown_failed: false, inconclusive: true }),
} satisfies Record<string, ReportReader>;

export type ReportKind = keyof typeof reportRegistry;

function parseXmlDocument(text: string): unknown {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("XML document types and entities are not allowed");
  checkXmlDepth(text);
  return parser.parse(text);
}

function checkXmlDepth(text: string): void {
  const stripped = text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .replace(/<(failure|error|system-out|system-err|flakyFailure|rerunFailure)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\?[\s\S]*?\?>/g, "");
  const unknownEntity = /&(?!(?:lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);)[^;\s<&]+;/i.exec(stripped);
  if (unknownEntity) throw new Error(`unknown XML entity ${unknownEntity[0]}`);
  const stack: string[] = [];
  for (let index = 0; index < stripped.length; index += 1) {
    if (stripped[index] !== "<") continue;
    let quote = "";
    let end = index + 1;
    for (; end < stripped.length; end += 1) {
      const char = stripped[end] ?? "";
      if (quote) {
        if (char === quote) quote = "";
        continue;
      }
      if (char === "'" || char === '"') quote = char;
      else if (char === ">") break;
    }
    if (end >= stripped.length) throw new Error("XML tag is unterminated");
    const token = stripped.slice(index, end + 1);
    const closing = /^<\s*\//.test(token);
    const declaration = /^<\s*[!?]/.test(token);
    const tagName = /^<\s*\/?\s*([A-Za-z_][\w:.-]*)/.exec(token)?.[1];
    if (closing) {
      const open = stack.pop();
      if (!open || open !== tagName) throw new Error("XML tags are unbalanced");
    } else if (!declaration && !/\/\s*>$/.test(token) && tagName) {
      stack.push(tagName);
      if (stack.length > 64) throw new Error("XML nesting exceeds 64 levels");
    }
    index = end;
  }
  if (stack.length !== 0) throw new Error("XML tags are unbalanced");
}

export function sourceFile(value: string, options: ReportReadOptions): string {
  const forward = value.replaceAll("\\", "/");
  if (options.cwd === undefined) return forward;
  const resolved = pathIsAbsolute(value) ? value : `${options.cwd.replaceAll("\\", "/").replace(/\/+$/, "")}/${forward}`;
  const relative = relativePath(options.cwd, resolved).replaceAll("\\", "/");
  return relative || ".";
}

type XmlNode = {
  name: string;
  attrs: Record<string, unknown>;
  children: XmlNode[];
  text: string;
};

function xmlNodes(value: unknown): XmlNode[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const attrs = isRecord(entry[":@"]) ? entry[":@"] : {};
    return Object.entries(entry).filter(([name]) => name !== ":@").map(([name, contents]) => ({
      name,
      attrs,
      children: xmlNodes(contents),
      text: typeof contents === "string" ? contents : "",
    }));
  });
}

const xmlEntities: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

function xmlAttr(node: XmlNode, name: string): string {
  return stringValue(node.attrs[name]).replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (_, entity: string) => {
    if (!entity.startsWith("#")) return xmlEntities[entity] ?? "";
    const hex = entity.startsWith("#x");
    const point = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
    if (point < 1 || point > 0x10ffff || (point >= 0xd800 && point < 0xe000)) {
      throw new Error("Invalid XML character reference");
    }
    return String.fromCodePoint(point);
  });
}

function parseJunit(text: string, options: ReportReadOptions) {
  const document = xmlNodes(parseXmlDocument(text));
  const roots = document.filter(({ name }) => name !== "#text" && !name.startsWith("?"));
  if (roots.length !== 1 || !roots.some(({ name }) => name === "testsuites" || name === "testsuite")) {
    throw new Error("expected a JUnit testsuites or testsuite document");
  }
  const collapsed = new Map<string, TestCase>();
  let rawCases = 0;
  let teardownFailed = false;

  function visit(nodes: XmlNode[], inheritedFile: string): void {
    for (const node of nodes) {
      if (node.name !== "testcase") {
        const file = node.name === "testsuite" ? xmlAttr(node, "file") || inheritedFile : inheritedFile;
        visit(node.children, file);
        continue;
      }
      rawCases += 1;
      if (rawCases > 20_000) throw new Error("report exceeds 20,000 cases");
      const parsed = junitCase(node, options, inheritedFile);
      teardownFailed ||= parsed.teardown;
      const testCase = parsed.testCase;
      const existing = collapsed.get(testCase.full_name);
      if (!existing) {
        collapsed.set(testCase.full_name, testCase);
        continue;
      }
      existing.status = testCase.status;
      existing.attempts.push(...testCase.attempts);
      existing.tags = unique([...existing.tags, ...testCase.tags]);
      if (!existing.file && testCase.file) existing.file = testCase.file;
      if (testCase.duration_ms !== undefined) existing.duration_ms = (existing.duration_ms ?? 0) + testCase.duration_ms;
    }
  }

  visit(roots, "");
  const cases = [...collapsed.values()];
  return { cases, teardown_failed: teardownFailed, inconclusive: cases.length === 0 };
}

function junitCase(node: XmlNode, options: ReportReadOptions, inheritedFile: string) {
  const name = xmlAttr(node, "name");
  const classname = xmlAttr(node, "classname");
  if (!name && !classname) throw new Error("JUnit test has no name or classname");
  const fullName = name && classname && classname !== name ? `${classname} > ${name}` : name || classname;
  const errors = node.children.filter((child) => child.name === "error");
  const isTeardown = (error: XmlNode): boolean => {
    const body = error.children.map(({ text }) => text).join("").trim();
    const reason = xmlAttr(error, "message") || body.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1").trim();
    return reason.startsWith("failed on teardown with");
  };
  const failure = node.children.filter((child) => child.name === "failure");
  const skipped = node.children.some((child) => child.name === "skipped");
  let status: TestStatus = "pass";
  if (skipped) status = "skip";
  else if (errors.some((error) => !isTeardown(error))) status = "error";
  else if (failure.length) status = "fail";

  const tags = extractTags(fullName, options.prefix);
  for (const properties of node.children.filter((child) => child.name === "properties")) {
    for (const property of properties.children) {
      if (property.name === "property" && xmlAttr(property, "name") === "tenet.case") {
        tags.push(...extractTokenTags(xmlAttr(property, "value"), options.prefix));
      }
    }
  }

  const retryCount = node.children.filter(({ name }) => name === "flakyFailure" || name === "rerunFailure").length;
  const testCase: TestCase = {
    full_name: fullName,
    status,
    attempts: [...Array<TestStatus>(retryCount).fill("fail"), status],
    tags: unique(tags),
  };
  const file = xmlAttr(node, "file");
  const displayFile = Object.hasOwn(node.attrs, "file") ? file : inheritedFile;
  if (displayFile) testCase.file = sourceFile(displayFile, options);
  else if (/[/\\]/.test(classname)) testCase.file = sourceFile(classname, options);
  const time = node.attrs.time;
  if (time !== undefined && Number.isFinite(Number(time))) testCase.duration_ms = Math.round(Number(time) * 1_000);

  const failed = status === "fail" || status === "error";
  const teardown = errors.some(isTeardown) || failure.some((entry) => xmlAttr(entry, "type") === "hookFailed") ||
    (failed && Boolean(name) && (name === classname || name === file));
  return { testCase, teardown };
}

function parseCtrf(text: string, options: ReportReadOptions) {
  const value = parseJson(text);
  const results = isRecord(value.results) ? value.results : value;
  const tests = results.tests;
  if (!Array.isArray(tests)) throw new Error("expected CTRF tests[]");
  if (tests.length > 20_000) throw new Error("report exceeds 20,000 cases");
  const cases = tests.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`CTRF test ${index} is not an object`);
    const name = stringValue(entry.name);
    if (!name) throw new Error(`CTRF test ${index} has no name`);
    const raw = stringValue(entry.status);
    const status: TestStatus = raw === "passed" ? "pass" : raw === "failed" ? "fail" : "skip";
    const extraTags = isRecord(entry.extra) && Array.isArray(entry.extra.tenet_cases)
      ? entry.extra.tenet_cases.flatMap((tag) => typeof tag === "string" ? extractTokenTags(tag, options.prefix) : [])
      : [];
    const file = stringValue(entry.filePath ?? entry.file);
    const duration = numberValue(entry.duration);
    const result: TestCase = {
      full_name: name,
      status,
      attempts: [status],
      tags: unique([...extractTags(name, options.prefix ?? "R"), ...extraTags]),
    };
    if (file) result.file = sourceFile(file, options);
    if (duration !== undefined) result.duration_ms = Math.round(duration);
    return result;
  });
  return { cases, teardown_failed: false, inconclusive: cases.length === 0 };
}

function parseGo(text: string, options: ReportReadOptions) {
  const terminals = new Map<string, TestCase>();
  const parents = new Set<string>();
  let rawCases = 0;
  for (const [index, raw] of text.replaceAll("\r\n", "\n").split("\n").entries()) {
    if (!raw.trim()) continue;
    let entry: unknown;
    try {
      entry = JSON.parse(raw);
    } catch {
      throw new Error(`line ${index + 1} is not JSON`);
    }
    if (!isRecord(entry)) throw new Error(`line ${index + 1} is not an object`);
    const test = stringValue(entry.Test);
    const action = entry.Action;
    if (!test || (action !== "pass" && action !== "fail" && action !== "skip")) continue;
    rawCases += 1;
    if (rawCases > 20_000) throw new Error("report exceeds 20,000 cases");

    const packageName = stringValue(entry.Package);
    const key = `${packageName}\0${test}`;
    for (let slash = test.indexOf("/"); slash !== -1; slash = test.indexOf("/", slash + 1)) {
      parents.add(`${packageName}\0${test.slice(0, slash)}`);
    }
    const fullName = packageName ? `${packageName} > ${test}` : test;
    const testCase = terminals.get(key) ?? {
      full_name: fullName,
      status: action,
      attempts: [],
      tags: extractTags(fullName, options.prefix),
    };
    testCase.status = action;
    testCase.attempts.push(action);
    const elapsed = numberValue(entry.Elapsed);
    if (elapsed !== undefined) testCase.duration_ms = Math.round(elapsed * 1_000);
    else delete testCase.duration_ms;
    terminals.set(key, testCase);
  }

  const cases = [...terminals].filter(([key]) => !parents.has(key)).map(([, testCase]) => testCase);
  return { cases, teardown_failed: false, inconclusive: cases.length === 0 };
}

function parseJest(text: string, options: ReportReadOptions) {
  const value = parseJson(text);
  const suites = value.testResults;
  if (!Array.isArray(suites)) throw new Error("expected Jest testResults[]");
  const cases: TestCase[] = [];
  let assertionCount = 0;
  let teardownFailed = false;
  for (const suite of suites) {
    if (!isRecord(suite)) throw new Error("Jest test result is not an object");
    const assertions = suite.assertionResults;
    if (!Array.isArray(assertions)) throw new Error("expected Jest assertionResults[]");
    assertionCount += assertions.length;
    if (assertionCount > 20_000) throw new Error("report exceeds 20,000 cases");
    const file = stringValue(suite.name);
    const suiteFailures = assertions.filter((entry) => isRecord(entry) && stringValue(entry.status) === "failed").length;
    if (stringValue(suite.status) === "failed" && suiteFailures === 0) teardownFailed = true;
    for (const assertion of assertions) {
      if (!isRecord(assertion)) throw new Error("Jest assertion result is not an object");
      const name = stringValue(assertion.fullName) || stringValue(assertion.title);
      if (!name) throw new Error("Jest assertion has no name");
      const raw = stringValue(assertion.status);
      let status: TestStatus;
      if (raw === "passed") status = "pass";
      else if (raw === "failed") status = "fail";
      else if (raw === "pending" || raw === "skipped" || raw === "todo") status = "skip";
      else throw new Error(`unknown Jest status ${raw}`);
      const invocations = numberValue(assertion.invocations);
      const reasons = Array.isArray(assertion.retryReasons)       ? assertion.retryReasons : [];
      const retries = invocations !== undefined ? Math.max(0, invocations - 1) : reasons.length;
      const testCase: TestCase = {
        full_name: name,
        status,
        attempts: [...Array<TestStatus>(retries).fill("fail"), status],
        tags: extractTags(name, options.prefix ?? "R"),
      };
      if (file) testCase.file = sourceFile(file, options);
      const duration = numberValue(assertion.duration);
      if (duration !== undefined) testCase.duration_ms = Math.round(duration);
      cases.push(testCase);
    }
  }
  return { cases, teardown_failed: teardownFailed, inconclusive: cases.length === 0 };
}

function parseJson(text: string): Record<string, unknown> {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value)) throw new Error("expected a JSON object");
  return value;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function numberValue(value: unknown): number | undefined {
  if (typeof value !== "number") return undefined;
  return Number.isFinite(value) ? value : undefined;
}

function pathIsAbsolute(value: string): boolean {
  return path.isAbsolute(value) || path.win32.isAbsolute(value);
}

function relativePath(from: string, to: string): string {
  return path.relative(path.resolve(from), path.resolve(to));
}

export function readBounded(filename: string): string {
  const limit = 50 * 1024 * 1024;
  if (statSync(filename).size > limit) throw new Error(`file exceeds ${String(limit)} bytes`);
  return readFileSync(filename, "utf8");
}
