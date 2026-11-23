import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function loadPolicyModule() {
  const root = path.resolve(".");
  const output = path.join(root, "dist", "policy", "index.js");
  execFileSync(
    process.execPath,
    [
      path.join(root, "node_modules", "typescript", "bin", "tsc"),
      "--target",
      "ES2023",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "--strict",
      "--noUncheckedIndexedAccess",
      "--exactOptionalPropertyTypes",
      "--verbatimModuleSyntax",
      "--noEmitOnError",
      "--skipLibCheck",
      "--outDir",
      "dist",
      "--rootDir",
      "src",
      "--declaration",
      "src/policy/index.ts",
    ],
    { cwd: root, stdio: "inherit" },
  );
  return import(pathToFileURL(output).href);
}
