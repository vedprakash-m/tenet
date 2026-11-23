import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDependencies = [
  "ajv",
  "ajv-formats",
  "commander",
  "fast-xml-parser",
  "picomatch",
  "yaml",
];
const importTable = [
  ["src/types/", "nothing"],
  ["src/core/", "types"],
  ["src/policy/", "types, core"],
  ["src/specs/", "types, core, policy"],
  ["src/onboard/", "types, core, policy, specs, reports"],
  ["src/context/", "types, core, policy, specs"],
  ["src/reports/", "types, core"],
  ["src/kernel/", "types, core, policy"],
  ["src/verify/", "all above except install, mcp"],
  ["src/views/", "types, core, policy, specs, reports, kernel"],
  ["src/mcp/", "types, core, policy, specs, context, views"],
  ["src/install/", "all above except verify"],
  ["src/commands/", "all except mcp"],
  ["src/sdk.ts, src/cli.ts", "all"],
  ["runner/", "the published SDK only"],
];
const allowedImports = new Map<string, string[]>([
  ["types", []],
  ["core", ["types"]],
  ["policy", ["types", "core"]],
  ["specs", ["types", "core", "policy"]],
  ["onboard", ["types", "core", "policy", "specs", "reports"]],
  ["context", ["types", "core", "policy", "specs"]],
  ["reports", ["types", "core"]],
  ["kernel", ["types", "core", "policy"]],
  ["verify", ["types", "core", "policy", "specs", "onboard", "context", "reports", "kernel"]],
  ["views", ["types", "core", "policy", "specs", "reports", "kernel"]],
  ["mcp", ["types", "core", "policy", "specs", "context", "views"]],
  ["install", ["types", "core", "policy", "specs", "onboard", "context", "reports", "kernel", "views", "mcp"]],
  ["commands", ["types", "core", "policy", "specs", "onboard", "context", "reports", "kernel", "verify", "views", "install"]],
  ["all", ["types", "core", "policy", "specs", "onboard", "context", "reports", "kernel", "verify", "views", "mcp", "install", "commands"]],
]);

function normalizedCell(value: string) {
  return value.replaceAll("`", "").replaceAll("*", "").trim();
}

async function sourceFiles(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) files.push(...(await sourceFiles(fullPath)));
      if (entry.isFile() && entry.name.endsWith(".ts")) files.push(fullPath);
    }
    return files;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function moduleArea(filename: string) {
  const relative = path.relative(path.join(root, "src"), filename).replaceAll(path.sep, "/");
  if (relative === "sdk.ts" || relative === "cli.ts") return "all";
  return relative.split("/", 1)[0];
}

function packageName(specifier: string) {
  if (!specifier.startsWith("@")) return specifier.split("/", 1)[0];
  return specifier.split("/", 2).join("/");
}

test("tech spec architecture table is the enforced dependency map", async () => {
  const specification = await readFile(path.join(root, "tenet", "specs", "tech-spec.md"), "utf8");
  const section = specification.match(/^## 1\. Architecture[\s\S]*?(?=^## 2\.)/m)?.[0];
  assert.ok(section, "tech-spec.md section 1 must exist");

  const actual = section
    .split(/\r?\n/)
    .filter((line) => line.startsWith("| `"))
    .map((line) => {
      const cells = line.slice(1, -1).split("|").map((cell) => cell.trim());
      const selectors = [...cells[0].matchAll(/`([^`]+)`/g)].map((match) => match[1]);
      return [selectors.join(", "), normalizedCell(cells.at(-1) ?? "")];
    });
  assert.deepEqual(actual, importTable);
});

test("package runtime dependencies exactly match the architecture contract", async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  assert.deepEqual(Object.keys(packageJson.dependencies ?? {}).sort(), runtimeDependencies);
});

test("source imports stay inside the tech spec dependency map", async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  for (const filename of await sourceFiles(path.join(root, "src"))) {
    const source = await readFile(filename, "utf8");
    const area = moduleArea(filename);
    for (const match of source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)) {
      const specifier = match[1];
      if (specifier.startsWith("node:")) continue;
      if (!specifier.startsWith(".")) {
        assert.ok(runtimeDependencies.includes(packageName(specifier)), `${path.relative(root, filename)} imports undeclared runtime package ${specifier}`);
        assert.ok(packageJson.dependencies[packageName(specifier)], `${packageName(specifier)} must remain a runtime dependency`);
        continue;
      }
      if (area === "all") continue;
      const resolved = path.resolve(path.dirname(filename), specifier).replace(/\.js$/, ".ts");
      const targetArea = moduleArea(resolved);
      const allowed = allowedImports.get(area) ?? [];
      assert.ok(
        targetArea === area || allowed.includes(targetArea),
        `${path.relative(root, filename)} may not import ${specifier}`,
      );
    }
  }

  for (const filename of await sourceFiles(path.join(root, "runner"))) {
    const source = await readFile(filename, "utf8");
    for (const match of source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)) {
      const specifier = match[1];
      if (specifier.startsWith(".") || specifier.startsWith("node:")) continue;
      assert.equal(
        specifier,
        "@vedprakash-m/tenet",
        `${path.relative(root, filename)} may import only the published SDK`,
      );
    }
  }
});