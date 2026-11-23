import { readFile } from "node:fs/promises";
import { parseDocument } from "yaml";

export async function readYaml(filename: string): Promise<unknown> {
  const text = await readFile(filename, "utf8");
  const document = parseDocument(text, {
    merge: false,
    prettyErrors: true,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    const error = document.errors[0];
    throw error ?? new Error(`cannot parse YAML: ${filename}`);
  }
  return document.toJS({ maxAliasCount: 100 });
}
