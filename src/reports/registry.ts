import { readFileSync, statSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";
import type { ReportReadOptions, ReportReader } from "./read-types.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: false,
  processEntities: true,
  stopNodes: ["*.failure", "*.error", "*.system-out", "*.system-err", "*.flakyFailure", "*.rerunFailure"],
  isArray: (name) =>
    ["testsuite", "testcase", "property", "failure", "error", "skipped", "flakyFailure", "rerunFailure"].includes(name),
});

export const reportRegistry = {
  junit: (text, options) => parseJunit(text, options),
  ctrf: (text, options) => parseCtrf(text, options),
  "go-test-json": (text, options) => parseGo(text, options),
  "jest-json": (text, options) => parseJest(text, options),
  none: () => ({ cases: [], teardown_failed: false, inconclusive: true }),
} satisfies Record<string, ReportReader>;

export type ReportKind = keyof typeof reportRegistry;

export function parseXmlDocument(text: string): unknown {
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

function parseJunit(
  text: string,
  options: ReportReadOptions,
): { cases: ReturnType<typeof junitCase>[]; teardown_failed: boolean; inconclusive: boolean } {
  const document = parseXmlDocument(text);
  if (!isRecord(document) || !(hasKey(document, "testsuites") || hasKey(document, "testsuite"))) {
    throw new Error("expected a JUnit testsuites or testsuite document");
  }
  const caseNodes: Record<string, unknown>[] = [];
  collectNodes(document, "testcase", caseNodes);
  if (caseNodes.length > 20_000) throw new Error("report exceeds 20,000 cases");
  const collapsed = new Map<string, ReturnType<typeof junitCase>>();
  let teardownFailed = false;
  for (const node of caseNodes) {
    const parsed = junitCase(node, options);
    const flaky = oneOrMany(node.flakyFailure).length;
    const rerun = oneOrMany(node.rerunFailure).length;
    if (flaky + rerun > 0) parsed.attempts.splice(0, 0, ...Array<TestStatus>(flaky + rerun).fill("fail"));
    if (isTeardownCase(node, parsed)) teardownFailed = true;
    const existing = collapsed.get(parsed.full_name);
    if (existing) {
      existing.status = parsed.status;
      existing.attempts.push(...parsed.attempts);
      existing.tags = unique([...existing.tags, ...parsed.tags]);
      if (!existing.file && parsed.file) existing.file = parsed.file;
      if (parsed.duration_ms !== undefined) existing.duration_ms = (existing.duration_ms ?? 0) + parsed.duration_ms;
    } else {
      collapsed.set(parsed.full_name, parsed);
    }
  }
  const cases = [...collapsed.values()];
  return { cases, teardown_failed: teardownFailed, inconclusive: cases.length === 0 };
}

import path from "node:path";
import { extractTags, extractTokenTags } from "./tags.js";
import type { TestCase, TestStatus } from "./types.js";

function junitCase(node: Record<string, unknown>, options: ReportReadOptions): TestCase {
  const name = stringValue(node.name);
  const classname = stringValue(node.classname);
  const fullName = !classname || classname === name ? name : `${classname} > ${name}`;
  const failure = oneOrMany(node.failure);
  const error = oneOrMany(node.error);
  const skipped = oneOrMany(node.skipped);
  let status: TestStatus = "pass";
  if (skipped.length > 0) status = "skip";
  else if (error.length > 0 && !isTeardownError(node)) status = "error";
  else if (failure.length > 0) status = "fail";
  const properties: Record<string, unknown>[] = [];
  collectNodes(node, "property", properties);
  const tags = [...extractTags(fullName, options.prefix ?? "R")];
  for (const property of properties) {
    if (stringValue(property.name) !== "tenet.case") continue;
    tags.push(...tokenTags(stringValue(property.value), options.prefix ?? "R"));
  }
  const fileValue = stringValue(node.file);
  const time = stringValue(node.time);
  const duration = Number(time);
  const result: TestCase = {
    full_name: fullName,
    status,
    attempts: [status],
    tags: unique(tags),
  };
  if (fileValue) result.file = sourceFile(fileValue, options);
  else if (/[/\\]/.test(classname)) result.file = sourceFile(classname, options);
  if (time.length > 0 && Number.isFinite(duration)) result.duration_ms = Math.round(duration * 1_000);
  return result;
}

function isTeardownError(node: Record<string, unknown>): boolean {
  return oneOrMany(node.error).some((entry) =>
    isRecord(entry) && stringValue(entry.message).startsWith("failed on teardown with"),
  );
}

function isTeardownCase(node: Record<string, unknown>, testCase: TestCase): boolean {
  if (isTeardownError(node)) return true;
  if (oneOrMany(node.failure).some((entry) =>
    isRecord(entry) && stringValue(entry.type) === "hookFailed"
  )) return true;
  if (
    (testCase.status === "fail" || testCase.status === "error") &&
    stringValue(node.file) !== "" &&
    stringValue(node.name) === stringValue(node.file)
  ) return true;
  const classname = stringValue(node.classname);
  const name = stringValue(node.name);
  return Boolean(classname && classname === name && (testCase.status === "fail" || testCase.status === "error"));
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
      ? entry.extra.tenet_cases.flatMap((tag) => tokenTags(String(tag), options.prefix ?? "R"))
      : [];
    const file = stringValue(entry.file) || stringValue(entry.filepath);
    const duration = Number(entry.duration);
    const result: TestCase = {
      full_name: name,
      status,
      attempts: [status],
      tags: unique([...extractTags(name, options.prefix ?? "R"), ...extraTags]),
    };
    if (file) result.file = sourceFile(file, options);
    if (Number.isFinite(duration)) result.duration_ms = Math.round(duration);
    return result;
  });
  return { cases, teardown_failed: false, inconclusive: cases.length === 0 };
}

function parseGo(text: string, options: ReportReadOptions) {
  const terminals = new Map<string, { packageName: string; test: string; action: string }>();
  const names = new Set<string>();
  for (const [index, raw] of text.replaceAll("\r\n", "\n").split("\n").entries()) {
    if (!raw.trim()) continue;
    let entry: unknown;
    try {
      entry = JSON.parse(raw);
    } catch {
      throw new Error(`line ${String(index + 1)} is not JSON`);
    }
    if (!isRecord(entry)) throw new Error(`line ${String(index + 1)} is not an object`);
    const test = stringValue(entry.Test);
    const action = stringValue(entry.Action);
    const packageName = stringValue(entry.Package);
    if (!test) continue;
    names.add(`${packageName}\0${test}`);
    if (["output", "run", "pause", "cont"].includes(action)) continue;
    if (!["pass", "fail", "skip"].includes(action)) continue;
    terminals.set(`${packageName}\0${test}`, { packageName, test, action });
  }
  const cases: TestCase[] = [];
  for (const terminal of terminals.values()) {
    if ([...names].some((name) => name.startsWith(`${terminal.packageName}\0${terminal.test}/`))) continue;
    const status = terminal.action as TestStatus;
    const fullName = terminal.packageName ? `${terminal.packageName} > ${terminal.test}` : terminal.test;
    cases.push({
      full_name: fullName,
      status,
      attempts: [status],
      tags: extractTags(fullName, options.prefix ?? "R"),
    });
    if (cases.length > 20_000) throw new Error("report exceeds 20,000 cases");
  }
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
      const status: TestStatus =
        raw === "passed" ? "pass" : raw === "failed" ? "fail" : ["pending", "skipped", "todo"].includes(raw)
          ? "skip"
          : "skip";
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

function collectNodes(value: unknown, name: string, output: Record<string, unknown>[]): void {
  if (Array.isArray(value)) {
    for (const entry of value) collectNodes(entry, name, output);
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (key === name) {
      for (const entry of oneOrMany(child)) if (isRecord(entry)) output.push(entry);
      continue;
    }
    collectNodes(child, name, output);
  }
}

function tokenTags(text: string, prefix: string): string[] {
  return extractTokenTags(text, prefix);
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function oneOrMany(value: unknown): unknown[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasKey(value: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(value, key);
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
