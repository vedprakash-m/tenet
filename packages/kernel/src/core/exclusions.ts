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
const SECRET = [/^(?:.*\/)?\.env(?:\..+)?$/, /\.(?:pem|key|p12)$/, /(?:^|\/)id_(?:rsa|ed25519)[^/]*$/, /(?:^|\/)\.npmrc$/, /(?:^|\/)\.(?:aws|azure|config\/gcloud)(?:\/|$)/].map((r) => r);
const SECRET_EXCEPTION = /(?:^|\/)\.env\.example$/;
const KERNEL_ONLY = /^\.tenet(?:\/|$)|(?:^|\/)\.tenet-write-[a-f0-9-]{36}\.tmp$/;
const isSecret = (p: string): boolean => !SECRET_EXCEPTION.test(p) && SECRET.some((r) => r.test(p));
export const isKernelFile = (p: string): boolean => KERNEL_ONLY.test(p);

export function packetExclusions(effective: readonly Exclusion[] = []) {
  return {
    mechanism: "cooperative",
    defaults: {
      kernelOnly: KERNEL_ONLY.source, secretPatterns: SECRET.map(pattern => pattern.source),
      secretException: SECRET_EXCEPTION.source,
    },
    effective: effective.map(rule => ({ pattern: rule.pattern, kinds: [...rule.kinds] })),
    guidance: [
      "Apply these restrictions before any read or search, including native tools; tool availability is not permission.",
      "Defaults are regular expressions; effective patterns are workspace-relative globs. Union every restriction.",
      ".tenet and reserved atomic temporaries are kernel-only: never open, search, quote or attach their contents.",
      "Default secret patterns forbid content reads/searches; the secretException applies only to secret patterns.",
      "no-read, no-model-send and no-routine-scan prohibit affected model reads/searches; report needed evidence as unavailable.",
      "no-edit forbids modification and no-export forbids export. A read-only assignment never writes, executes or delegates.",
      "Use this packet's evidence summaries, not local kernel records. Do not inspect unrelated histories or sibling projects.",
    ],
  };
}

export function allowed(op: Op, path: string, extra: readonly Exclusion[] = []): boolean {
  if (isSecret(path)) return false;
  if (isKernelFile(path)) return false;
  const kinds = new Set<Kind>(extra.filter((e) => matches(e.pattern, path)).flatMap((e) => e.kinds));
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
