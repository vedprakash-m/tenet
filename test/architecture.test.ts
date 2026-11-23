import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

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
  ["commands", ["types", "core", "policy", "specs", "onboard", "context", "reports", "kernel", "verify", "views", "install", "all"]],
  ["all", ["types", "core", "policy", "specs", "onboard", "context", "reports", "kernel", "verify", "views", "mcp", "install", "commands"]],
]);

type PackageManifest = {
  dependencies?: Record<string, string>;
};

type ImportReference = {
  dynamic: boolean;
  specifier?: string;
};

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
  return relative.split("/", 1)[0] ?? "unknown";
}

function packageName(specifier: string) {
  if (!specifier.startsWith("@")) return specifier.split("/", 1)[0] ?? specifier;
  const [scope, name] = specifier.split("/");
  return scope && name ? `${scope}/${name}` : specifier;
}

function importReferences(filename: string, source: string): ImportReference[] {
  const document = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const references: ImportReference[] = [];
  const addSpecifier = (node: ts.Expression | undefined, dynamic: boolean) => {
    if (node && ts.isStringLiteralLike(node)) {
      references.push({ dynamic, specifier: node.text });
    } else if (dynamic) {
      references.push({ dynamic });
    }
  };

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addSpecifier(node.moduleSpecifier, false);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      addSpecifier(node.moduleReference.expression, false);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      addSpecifier(node.arguments[0], true);
    } else if (ts.isImportTypeNode(node)) {
      addSpecifier(
        ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)
          ? node.argument.literal
          : undefined,
        true,
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(document);
  return references;
}

function enforceImports(filename: string, source: string, packageJson: PackageManifest) {
  const area = moduleArea(filename);
  for (const reference of importReferences(filename, source)) {
    assert.ok(reference.specifier !== undefined, `${path.relative(root, filename)} has a computed dynamic import`);
    const specifier = reference.specifier;
    if (specifier.startsWith("node:")) continue;
    if (!specifier.startsWith(".")) {
      const dependency = packageName(specifier);
      assert.ok(
        runtimeDependencies.includes(dependency),
        `${path.relative(root, filename)} imports undeclared runtime package ${specifier}`,
      );
      assert.ok(
        packageJson.dependencies?.[dependency],
        `${dependency} must remain a runtime dependency`,
      );
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

test("tech spec architecture table is the enforced dependency map", async () => {
  const specification = await readFile(path.join(root, "tenet", "specs", "tech-spec.md"), "utf8");
  const section = specification.match(/^## 1\. Architecture[\s\S]*?(?=^## 2\.)/m)?.[0];
  assert.ok(section, "tech-spec.md section 1 must exist");

  const actual = section
    .split(/\r?\n/)
    .filter((line) => line.startsWith("| `"))
    .map((line) => {
      const cells = line.slice(1, -1).split("|").map((cell) => cell.trim());
      const selectorCell = cells[0] ?? "";
      const selectors = [...selectorCell.matchAll(/`([^`]+)`/g)].flatMap((match) => {
        const selector = match[1];
        return selector === undefined ? [] : [selector];
      });
      return [selectors.join(", "), normalizedCell(cells.at(-1) ?? "")];
    });
  assert.deepEqual(actual, importTable);
});

test("package runtime dependencies exactly match the architecture contract", async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as PackageManifest;
  assert.deepEqual(Object.keys(packageJson.dependencies ?? {}).sort(), runtimeDependencies);
});

test("import discovery covers static and dynamic import forms", () => {
  const references = importReferences(
    "sample.ts",
    [
      'import "yaml";',
      'import { readFile } from "node:fs/promises";',
      'export { load } from "yaml";',
      'void import("./core/load.js");',
      "void import(`./policy/load.js`);",
      "void import(moduleName);",
    ].join("\n"),
  );
  assert.deepEqual(references, [
    { dynamic: false, specifier: "yaml" },
    { dynamic: false, specifier: "node:fs/promises" },
    { dynamic: false, specifier: "yaml" },
    { dynamic: true, specifier: "./core/load.js" },
    { dynamic: true, specifier: "./policy/load.js" },
    { dynamic: true },
  ]);
});

test("dynamic imports enforce dependency and module boundaries", () => {
  const packageJson: PackageManifest = { dependencies: Object.fromEntries(runtimeDependencies.map((name) => [name, "test"])) };
  const filename = path.join(root, "src", "policy", "sample.ts");
  assert.throws(
    () => enforceImports(filename, 'void import("not-allowed");', packageJson),
    /imports undeclared runtime package/,
  );
  assert.throws(
    () => enforceImports(filename, 'void import("../verify/sample.js");', packageJson),
    /may not import/,
  );
  assert.throws(
    () => enforceImports(filename, "void import(moduleName);", packageJson),
    /computed dynamic import/,
  );
  assert.doesNotThrow(() => enforceImports(filename, 'void import("../core/sample.js");', packageJson));
  assert.doesNotThrow(() => enforceImports(filename, 'void import("yaml");', packageJson));
});

test("source imports stay inside the tech spec dependency map", async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as PackageManifest;
  for (const filename of await sourceFiles(path.join(root, "src"))) {
    const source = await readFile(filename, "utf8");
    enforceImports(filename, source, packageJson);
  }

  for (const filename of await sourceFiles(path.join(root, "runner"))) {
    const source = await readFile(filename, "utf8");
    for (const reference of importReferences(filename, source)) {
      assert.ok(reference.specifier !== undefined, `${path.relative(root, filename)} has a computed dynamic import`);
      const specifier = reference.specifier;
      if (specifier.startsWith(".") || specifier.startsWith("node:")) continue;
      assert.equal(
        specifier,
        "@vedprakash-m/tenet",
        `${path.relative(root, filename)} may import only the published SDK`,
      );
    }
  }
});