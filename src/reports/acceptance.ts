import { jcs, sha256 } from "../core/hash.js";
import type { Finding } from "../core/output.js";
import type { Acceptance } from "./types.js";

export function parseAcceptance(text: string): Acceptance {
  const implementationIds = new Set<string>();
  const items: Acceptance["items"] = [];
  const seen = new Set<string>();
  const problems: Finding[] = [];
  let heading = false;
  let fence: string | undefined;
  const lines = text.replaceAll("\r\n", "\n").split("\n");

  for (const [index, line] of lines.entries()) {
    const marker = /^ {0,3}(\x60{3,}|~{3,})(.*)$/.exec(line);
    const run = marker?.[1];
    if (fence) {
      if (run && run[0] === fence[0] && run.length >= fence.length && !marker?.[2]?.trim()) fence = undefined;
      continue;
    }
    if (run && (run[0] === "~" || !marker?.[2]?.includes("\x60"))) {
      fence = run;
      continue;
    }
    if (!heading) {
      heading = /^ {0,3}#{2,3}[ \t]+Acceptance[ \t]*$/.test(line);
      continue;
    }
    if (/^ {0,3}#{1,6}(?:[ \t]|$)/.test(line)) break;

    const implementation = /^Implements:\s*(.+)$/.exec(line)?.[1];
    if (implementation) {
      for (const value of implementation.split(",")) {
        const id = value.trim();
        if (id) implementationIds.add(id);
      }
      continue;
    }

    const tagged = /^\s*[-*]\s*(?:\[[ xX]\]\s*)?\[(AB-\d+)\]\s+(.+)$/.exec(line);
    const id = tagged?.[1];
    const itemText = tagged?.[2]?.trim();
    if (!id || !itemText) {
      if (/^\s*[-*](?:\s|$)/.test(line)) problems.push(acceptanceProblem(index + 1));
      continue;
    }
    if (seen.has(id)) {
      problems.push(acceptanceProblem(index + 1, id));
      continue;
    }
    seen.add(id);
    items.push({ id, text: itemText });
  }

  const implementsInOrder = [...implementationIds];
  const digest = sha256(jcs({
    implements: [...implementsInOrder].sort(ascii),
    items: items.map(({ id, text }) => ({ id, text: text.replace(/\s+/g, " ") }))
      .sort((left, right) => ascii(left.id, right.id)),
  }));
  return { implements: implementsInOrder, items, digest, problems };
}

function acceptanceProblem(line: number, id?: string): Finding {
  const location = { severity: "error", rule: null, file: null, line } as const;
  if (id === undefined) {
    return {
      ...location,
      code: "TN-ACC-MISSING-ID",
      message: "Acceptance item needs an ID.",
      fix: "Prefix the item with [AB-<n>].",
    };
  }
  return {
    ...location,
    code: "TN-ACC-DUP-ID",
    message: `Duplicate acceptance item ID ${id}.`,
    fix: `Renumber or remove the repeated ${id} item.`,
  };
}

function ascii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
