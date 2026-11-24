import path from "node:path";
import { pathToFileURL } from "node:url";

// npm test builds dist once before any test runs; tests never compile into dist themselves,
// because a rebuild during the run races other test files importing from dist.
export async function loadPolicyModule() {
  const output = path.join(path.resolve("."), "dist", "policy", "index.js");
  return import(pathToFileURL(output).href);
}
