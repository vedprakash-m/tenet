import type { Finding } from "../types/generated.js";
import { citationParts, docSection, testSegmentsResolve } from "./anchors.js";
import { itemLine, type ParsedDoc, type Requirement } from "./parse.js";

type Reader = (path: string) => string | null;

function citationFinding(
  code: string,
  doc: ParsedDoc,
  item: Requirement,
  values: Record<string, string>,
  malformed = false,
): Finding {
  const messages: Record<string, [string, string, string]> = {
    "TN-CITE-FILE": [
      "Cited file {path} was not found.",
      "Update the citation path or restore {path}.",
      "citations-valid",
    ],
    "TN-CITE-RANGE": [
      "Citation {cite} has an invalid line range or format.",
      "Fix {cite} to use a valid path:line or path:start-end within file length.",
      "citations-valid",
    ],
    "TN-CITE-HEADING": [
      "Cited heading #{slug} was not found in {path}.",
      "Update the doc: citation to an existing heading slug in {path}.",
      "citations-valid",
    ],
    "TN-CITE-TEST": [
      "Cited test {name} was not found in {file}.",
      "Update the test: citation to match a declared test in {file}.",
      "citations-valid",
    ],
  };
  const details = messages[code];
  const fill = (value: string) => value.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);
  return {
    code,
    severity: "error",
    rule: details?.[2] ?? "citations-valid",
    file: doc.path,
    line: itemLine(item),
    message: malformed ? "citation is malformed" : fill(details?.[0] ?? ""),
    fix: fill(details?.[1] ?? ""),
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
          findings.push(citationFinding("TN-CITE-RANGE", doc, item, { cite }, true));
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
