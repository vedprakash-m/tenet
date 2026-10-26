import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SUMS = "SHA256SUMS";

export function payloadInventory(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error("invalid payload inventory: expected nonempty array");
  const names = new Set<string>();
  const paths: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item === SUMS || !/^[A-Za-z0-9._/-]+$/.test(item)
      || item.split("/").some(part => !part || part === "." || part === ".." || part.endsWith("."))) {
      throw new Error("invalid payload inventory: expected canonical relative file paths");
    }
    const key = item.toLowerCase();
    if (names.has(key)) throw new Error(`invalid payload inventory: duplicate or case-colliding path: ${item}`);
    names.add(key);
    paths.push(item);
  }
  return paths.sort();
}

export function payloadFiles(root: string, prefix = ""): string[] {
  const directory = lstatSync(join(root, prefix));
  if (directory.isSymbolicLink()) throw new Error(`linked payload path: ${prefix || "."}`);
  if (!directory.isDirectory()) throw new Error(`non-directory payload path: ${prefix || "."}`);
  return readdirSync(join(root, prefix)).sort().flatMap(name => {
    const rel = prefix ? `${prefix}/${name}` : name;
    const stat = lstatSync(join(root, rel));
    if (stat.isSymbolicLink()) throw new Error(`linked payload path: ${rel}`);
    if (stat.isDirectory()) return payloadFiles(root, rel);
    if (!stat.isFile()) throw new Error(`nonregular payload path: ${rel}`);
    return rel === SUMS ? [] : [rel];
  });
}

/** Local byte inventory, not authenticity or atomic containment against concurrent path replacement. */
export function payloadChecksums(root: string, inventory: unknown): string {
  const expected = payloadInventory(inventory);
  const actual = new Set(payloadFiles(root));
  const allowed = new Set(expected);
  for (const path of expected) if (!actual.has(path)) throw new Error(`missing payload file: ${path}`);
  for (const path of actual) if (!allowed.has(path)) throw new Error(`unexpected payload file: ${path}`);
  return expected.map(path => `${createHash("sha256").update(readFileSync(join(root, path))).digest("hex")}  ${path}\n`).join("");
}

export function verifyPayload(root: string, inventory: unknown): void {
  const expected = payloadChecksums(root, inventory);
  if (readFileSync(join(root, SUMS), "utf8") !== expected) throw new Error("payload checksum mismatch: rebuild or restore payload");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const inventory: unknown = JSON.parse(readFileSync(join(import.meta.dirname, "payload-files.json"), "utf8"));
  verifyPayload(join(import.meta.dirname, "../plugin"), inventory);
  console.log("payload: checksum manifest matches complete inclusion list (local integrity only)");
}
