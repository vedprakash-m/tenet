import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const specDirectory = path.join(root, "tenet", "specs", "tech-spec");
const files = (await readdir(specDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
  .map((entry) => entry.name)
  .sort();
const fence = /^```yaml[^\r\n]*\r?\n([\s\S]*?)^```[ \t]*(?:\r?\n|$)/gm;
let blockCount = 0;

for (const file of files) {
  const source = await readFile(path.join(specDirectory, file), "utf8");
  for (const match of source.matchAll(fence)) {
    blockCount += 1;
    const document = parseDocument(match[1], { prettyErrors: false });
    if (document.errors.length > 0) {
      const line = source.slice(0, match.index).split(/\r?\n/).length + 1;
      const detail = document.errors.map((error) => error.message).join("; ");
      throw new Error(`${file}:${line}: invalid YAML fence: ${detail}`);
    }
  }
}

if (files.length === 0) {
  throw new Error("No tech-spec Markdown files found");
}

console.log(`Checked ${blockCount} YAML fenced block(s) in ${files.length} tech-spec file(s).`);