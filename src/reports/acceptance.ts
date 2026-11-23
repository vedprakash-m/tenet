import { jcs, sha256 } from "../core/hash.js";
import type { Finding } from "../core/output.js";
import type { Acceptance } from "./types.js";

export function parseAcceptance(text: string): Acceptance {
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  const implementationIds: string[] = [];
  const candidates: Array<{ id: string; text: string }> = [];
  const problems: Finding[] = [];
  let heading = -1;
  let headingFence = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (/^\s*```/.test(line) || /^\s*~~~/.test(line)) {
      headingFence = !headingFence;
      continue;
    }
    if (!headingFence && /^#{2,3}\s+Acceptance\s*$/.test(line)) {
      heading = index;
      break;
    }
  }

  if (heading >= 0) {
    const seen = new Set<string>();
    let fenced = false;
    for (let index = heading + 1; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      if (/^#{1,6}\s+/.test(line)) break;
      if (/^\s*```/.test(line) || /^\s*~~~/.test(line)) {
        fenced = !fenced;
        continue;
      }
      if (fenced) continue;
      const implementationLine = /^Implements:\s*(.+)$/.exec(line);
      if (implementationLine?.[1]) {
        for (const value of implementationLine[1].split(",")) {
          const id = value.trim();
          if (id) implementationIds.push(id);
        }
        continue;
      }
      const bullet = /^\s*[-*]\s+(.+)$/.exec(line);
      if (!bullet?.[1]) continue;
      const item = bullet[1].replace(/^\[[ xX]\]\s*/, "");
      const tagged = /^\[(AB-\d+)\]\s+(.+)$/.exec(item);
      if (!tagged?.[1] || !tagged[2]) {
        problems.push({
          code: "TN-ACC-MISSING-ID",
          severity: "error",
          rule: null,
          file: null,
          line: index + 1,
          message: "acceptance item needs an ID",
          fix: "Add a unique [AB-n] ID to the acceptance item.",
        });
        continue;
      }
      const id = tagged[1];
      if (seen.has(id)) {
        problems.push({
          code: "TN-ACC-DUP-ID",
          severity: "error",
          rule: null,
          file: null,
          line: index + 1,
          message: `acceptance item ID is repeated: ${id}`,
          fix: "Keep the first item and give this item a unique [AB-n] ID.",
        });
        continue;
      }
      seen.add(id);
      candidates.push({ id, text: tagged[2].trim().replace(/\s+/g, " ") });
    }
  }

  implementationIds.sort(ascii);
  candidates.sort((left, right) => ascii(left.id, right.id));
  const items = candidates.map((item) => ({ ...item }));
  return {
    implements: implementationIds,
    items,
    digest: sha256(jcs({ implements: implementationIds, items })),
    problems,
  };
}

function ascii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
