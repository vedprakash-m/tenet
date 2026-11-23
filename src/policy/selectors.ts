/// <reference path="./picomatch.d.ts" />
import picomatch from "picomatch";
import type { Change, Selector } from "./types.js";

function portablePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "").replace(/^\/+/, "");
}

function patternsFor(selector: Selector): string[] {
  if (typeof selector === "string") return [selector];
  if (Array.isArray(selector)) return selector;
  return [
    ...(selector.paths ?? []),
    ...(selector.include ?? []),
    ...(selector.exclude ?? []).map((pattern) => (pattern.startsWith("!") ? pattern : `!${pattern}`)),
  ];
}

function pathsFor(change: Change): string[] {
  if (typeof change === "string") return [change];
  if (Array.isArray(change)) return change;
  return [
    ...(change.path ? [change.path] : []),
    ...(change.paths ?? []),
    ...(change.before ? [change.before] : []),
    ...(change.after ? [change.after] : []),
  ];
}

function matchPattern(pattern: string, filename: string): boolean {
  let normalized = portablePath(pattern);
  if (normalized.endsWith("/")) normalized += "**";
  return picomatch(normalized, { dot: true, nocase: false })(filename);
}

export function match(selector: Selector, change: Change): boolean {
  const patterns = patternsFor(selector);
  const includes = patterns.filter((pattern) => !pattern.startsWith("!"));
  const excludes = patterns.filter((pattern) => pattern.startsWith("!")).map((pattern) => pattern.slice(1));
  const paths = pathsFor(change).map(portablePath);
  return paths.some(
    (filename) =>
      includes.some((pattern) => matchPattern(pattern, filename)) &&
      !excludes.some((pattern) => matchPattern(pattern, filename)),
  );
}
