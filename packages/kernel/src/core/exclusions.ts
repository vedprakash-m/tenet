// One predicate decides every content use (TS §9.4): exclusion kinds differ by operation, so a path is never
// "excluded" in general, only for an operation. Git ignore implies none of these.
export type Op = "scan" | "read" | "model-send" | "edit" | "export";
export type Kind = "no-model-send" | "no-read" | "no-edit" | "no-export" | "no-routine-scan";
export interface Exclusion { pattern: string; kinds: Kind[] }

export const glob = (g: string): RegExp => {
  const body = g.replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "\u0001").replace(/\/\*\*$/g, "\u0002").replace(/\*\*/g, "\u0003")
    .replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]")
    .replace(/\u0001/g, "(?:.*/)?").replace(/\u0002/g, "(?:/.*)?").replace(/\u0003/g, ".*");
  return new RegExp(`^(?:.*/)?${body}$`);
};

/** PRD 5.10.2 defaults: a secret file is stat-only to Tenet and never read, sent, edited or exported. */
const SECRET = [/^(?:.*\/)?\.env(?:\..+)?$/, /\.(?:pem|key|p12)$/, /(?:^|\/)id_(?:rsa|ed25519)[^/]*$/].map((r) => r);
const isSecret = (p: string): boolean => !/(?:^|\/)\.env\.example$/.test(p) && SECRET.some((r) => r.test(p));
const isTenetState = (p: string): boolean => p === ".tenet" || p.startsWith(".tenet/");

export function allowed(op: Op, path: string, extra: readonly Exclusion[] = []): boolean {
  if (isSecret(path)) return false;
  if (isTenetState(path)) return op !== "edit" && op !== "scan";
  const kinds = new Set<Kind>(extra.filter((e) => glob(e.pattern).test(path)).flatMap((e) => e.kinds));
  if (kinds.has("no-read")) return false;
  switch (op) {
    case "scan": return !kinds.has("no-routine-scan");
    case "read": return !kinds.has("no-routine-scan");
    case "model-send": return !kinds.has("no-model-send") && !kinds.has("no-routine-scan");
    case "edit": return !kinds.has("no-edit");
    case "export": return !kinds.has("no-export") && !kinds.has("no-model-send");
  }
}

/** A path matches a pattern exactly, as a directory prefix, or as a glob. */
export const matches = (pattern: string, path: string): boolean =>
  path === pattern || path.startsWith(`${pattern.replace(/\/$/, "")}/`) || glob(pattern).test(path);
