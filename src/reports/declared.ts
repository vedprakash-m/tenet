import { git } from "../core/git.js";
import { scanTestsDetailed, type DetailedScan, type ScanPolicy, type ScannedDeclaration } from "./scan.js";
import type { DeclaredTag, DeclaredTags } from "./types.js";

export async function declaredTags(
  base: string,
  head: string,
  prefix: string,
  options: { cwd?: string; test_files?: string[] } = {},
): Promise<DeclaredTags> {
  const cwd = options.cwd ?? process.cwd();
  const policy: ScanPolicy = { cwd, id_prefix: prefix };
  if (options.test_files !== undefined) policy.test_files = options.test_files;
  const [baseScan, headScan, renameSources, addedLines] = await Promise.all([
    scanTestsDetailed(base, policy),
    scanTestsDetailed(head, policy),
    renames(base, head, cwd),
    addedLineMap(base, head, cwd),
  ]);
  const result: DeclaredTags = { acceptance: {}, requirement: {} };

  for (const declaration of headScan.declarations) {
    const source = renameSources.get(declaration.file) ?? declaration.file;
    const authorship = authorshipFor(declaration, source, baseScan);
    const added = addedLines.get(declaration.file) ?? new Set<number>();
    for (const sourceTag of declaration.tag_sources) {
      if (/^AB-\d+$/.test(sourceTag.tag)) {
        if (!added.has(sourceTag.line)) continue;
        add(result.acceptance, sourceTag.tag, declared(declaration, sourceTag.tag, authorship));
      } else if (/^[A-Za-z]+-\d+$/.test(sourceTag.tag)) {
        add(result.requirement, sourceTag.tag, declared(declaration, sourceTag.tag, authorship));
      }
    }
  }
  return result;
}

function authorshipFor(
  declaration: ScannedDeclaration,
  baseFile: string,
  baseScan: DetailedScan,
): DeclaredTag["authorship"] {
  if (declaration.via_describe) return "unknown";
  const existed = baseScan.declarations.some(
    (candidate) => candidate.file === baseFile && candidate.name === declaration.name,
  );
  return existed ? "tag-added-here" : "written-here";
}

function declared(
  declaration: ScannedDeclaration,
  tag: string,
  authorship: DeclaredTag["authorship"],
): DeclaredTag {
  return {
    tag,
    file: declaration.file,
    line: declaration.line,
    name: declaration.name,
    raw_name: declaration.raw_name,
    authorship,
    via_describe: declaration.via_describe,
  };
}

function add(target: Record<string, DeclaredTag[]>, tag: string, value: DeclaredTag): void {
  const values = target[tag] ?? [];
  if (target[tag] === undefined) target[tag] = values;
  if (!values.some((item) =>
    item.file === value.file && item.line === value.line && item.raw_name === value.raw_name
  )) {
    values.push(value);
  }
}

async function renames(base: string, head: string, cwd: string): Promise<Map<string, string>> {
  const output = await git(["diff", "--name-status", "-z", "-M", `${base}..${head}`], { cwd });
  const fields = output.split("\0");
  const result = new Map<string, string>();
  for (let index = 0; index < fields.length; index += 1) {
    const status = fields[index] ?? "";
    if (!status) continue;
    if (status.startsWith("R")) {
      const before = fields[index + 1];
      const after = fields[index + 2];
      if (before !== undefined && after !== undefined) result.set(portable(after), portable(before));
      index += 2;
    } else if (index + 1 < fields.length) {
      index += 1;
    }
  }
  return result;
}

export async function addedLineMap(base: string, head: string, cwd: string): Promise<Map<string, Set<number>>> {
  const output = await git(["diff", "--unified=0", "--no-color", "-M", "--no-prefix", `${base}..${head}`], { cwd });
  const result = new Map<string, Set<number>>();
  let file: string | undefined;
  let added = 0;
  let remaining = 0;
  for (const line of output.replaceAll("\r\n", "\n").split("\n")) {
    if (line.startsWith("+++ ")) {
      const candidate = line.slice(4);
      file = candidate === "/dev/null" ? undefined : portable(candidate);
      continue;
    }
    const hunk = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk) {
      added = Number(hunk[2] ?? 0);
      remaining = Number(hunk[3] ?? 1);
      continue;
    }
    if (!file || remaining === 0) continue;
    if (line.startsWith("+") && !line.startsWith("+++")) {
      (result.get(file) ?? result.set(file, new Set()).get(file))?.add(added);
      added += 1;
      remaining -= 1;
    } else if (!line.startsWith("-") && !line.startsWith("\\")) {
      added += 1;
      remaining -= 1;
    }
  }
  return result;
}

function portable(value: string): string {
  return value.replaceAll("\\", "/");
}
