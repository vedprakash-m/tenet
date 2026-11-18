import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface Leaf { file: string; key: string }
interface Report { leaves: Leaf[] }

const argument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};

export function baselineFromReports(paths: string[], root: string): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const path of paths) {
    const report = JSON.parse(readFileSync(resolve(root, path), "utf8")) as Report;
    for (const leaf of report.leaves) {
      const key = `${leaf.file} :: ${leaf.key}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => ({ key, count }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const root = resolve(import.meta.dirname, "..");
  const source = argument("--source")?.split(",").filter(Boolean) ?? [];
  const postbuild = argument("--postbuild")?.split(",").filter(Boolean) ?? [];
  if (!source.length || !postbuild.length) {
    throw new Error("usage: update-test-baseline --source source.json[,..] --postbuild postbuild.json");
  }
  const baseline = {
    version: 1,
    lanes: { source: baselineFromReports(source, root), postbuild: baselineFromReports(postbuild, root) },
  };
  writeFileSync(resolve(root, "tools/test-baseline.json"), `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`test baseline: ${baseline.lanes.source.length} source keys, ${baseline.lanes.postbuild.length} postbuild keys`);
}
