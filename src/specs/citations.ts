import { message } from "../core/messages.js";
import type { Finding } from "../types/generated.js";
import { citationParts, docSection, testSegmentsResolve } from "./anchors.js";
import { itemLine, type ParsedDoc, type Requirement } from "./parse.js";

type Reader = (path: string) => string | null;

function citationFinding(
  code: string,
  doc: ParsedDoc,
  item: Requirement,
  values: Record<string, string>,
): Finding {
  const words = message(code, values);
  return {
    code,
    severity: "error",
    rule: "citations-valid",
    file: doc.path,
    line: itemLine(item),
    message: words.message,
    fix: words.fix,
  };
}

function lineCount(text: string): number {
  const lines = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.length;
}

export function resolveCitations(doc: ParsedDoc, readFile: Reader): Finding[] {
  const findings: Finding[] = [];
  for (const section of doc.sections) {
    for (const item of [...section.requirements, ...section.vision_items]) {
      for (const cite of item.cites) {
        const malformedTest = /^test:\s*/.test(cite) && !/\s+>\s+/.test(cite);
        const malformedDoc = /^doc:\s*/.test(cite) && !/.+#.+/.test(cite);
        const parsed = citationParts(cite);
        if (!parsed || malformedTest || malformedDoc) {
          findings.push(citationFinding("TN-CITE-RANGE", doc, item, { cite }));
          continue;
        }
        const file = readFile(parsed.path);
        if (file === null) {
          findings.push(citationFinding("TN-CITE-FILE", doc, item, { path: parsed.path }));
          continue;
        }
        if (parsed.kind === "path") {
          if (
            parsed.start < 1 ||
            parsed.end < parsed.start ||
            parsed.end > lineCount(file)
          ) {
            findings.push(citationFinding("TN-CITE-RANGE", doc, item, { cite }));
          }
        } else if (parsed.kind === "doc") {
          if (!docSection(parsed.path, file, parsed.slug)) {
            findings.push(citationFinding("TN-CITE-HEADING", doc, item, {
              path: parsed.path,
              slug: parsed.slug,
            }));
          }
        } else if (!testSegmentsResolve(file, parsed.segments)) {
          findings.push(citationFinding("TN-CITE-TEST", doc, item, {
            file: parsed.path,
            name: parsed.segments.join(" > "),
          }));
        }
      }
    }
  }
  return findings;
}
