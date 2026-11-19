// One predicate decides every content use (TS §9.4): exclusion kinds differ by operation, so a path is never
// "excluded" in general, only for an operation. Git ignore implies none of these.
import { policyKey, policyPath } from "./policy-path.ts";
export type Op = "scan" | "read" | "model-send" | "edit" | "export";
export type Kind = "no-model-send" | "no-read" | "no-edit" | "no-export" | "no-routine-scan";
export interface Exclusion { pattern: string; kinds: Kind[] }
export interface ReadEpoch { policyHash: string; questionId: string; factsHash: string }
export type ReadUse = { kind: "routine-inventory" | "routine-search" }
  | { kind: "explicit"; destination: "kernel" | "model"; binding: ReadEpoch & { path: string } };
export interface ReadAdmission { use: ReadUse; current?: () => ReadEpoch }
export type PolicyMode = "folded" | "exact-authenticated";
export interface ExclusionRule extends Exclusion { source: "default-secret" | "kernel-only" | "configured" }

export const glob = (g: string, anchored = false): RegExp => {
  const syntax: Record<string, string> = {
    "**/": "(?:[\\s\\S]*/)?", "/**": "(?:/[\\s\\S]*)?", "**": "[\\s\\S]*", "*": "[^/]*", "?": "[^/]",
  };
  const body = (g.match(/\*\*\/|\/\*\*(?![\s\S])|\*\*|\*|\?|[\s\S]/g) ?? [])
    .map(token => syntax[token] ?? token.replace(/[.+^${}()|[\]\\]/g, "\\$&")).join("");
  return new RegExp(`^${anchored ? "" : "(?:[\\s\\S]*/)?"}${body}(?![\\s\\S])`, "u");
};

const ALL: Kind[] = ["no-read", "no-model-send", "no-edit", "no-export", "no-routine-scan"];
export const DEFAULT_RULES: readonly ExclusionRule[] = [
  ...[".env", ".env.?*", "*.pem", "*.key", "*.p12", "id_rsa*", "id_ed25519*", ".npmrc",
    ".aws/**", ".azure/**", ".config/gcloud/**"].map(pattern => ({ pattern, kinds: [...ALL], source: "default-secret" as const })),
  { pattern: "/.tenet/**", kinds: [...ALL], source: "kernel-only" },
  { pattern: `.tenet-write-${"?".repeat(36)}.tmp`, kinds: [...ALL], source: "kernel-only" },
];
export const DEFAULT_EXCEPTION = { pattern: ".env.example", target: "default-secret" } as const;
export const isKernelFile = (p: string): boolean =>
  DEFAULT_RULES.some(rule => rule.source === "kernel-only" && matches(rule.pattern, p));

function currentExplicit(op: Op, path: string, use?: ReadUse, current?: ReadEpoch): boolean {
  if (use?.kind !== "explicit" || !current || use.binding?.path !== path) return false;
  if (use.destination !== "model" && use.destination !== "kernel") return false;
  if (op === "model-send" && use.destination !== "model") return false;
  return (["policyHash", "questionId", "factsHash"] as const).every(key =>
    typeof current[key] === "string" && current[key].length > 0 && current[key] === use.binding[key]);
}

export function allowed(
  op: Op, path: string, extra: readonly Exclusion[] = [], use?: ReadUse, current?: ReadEpoch,
): boolean {
  return allowedByRules(op, path, [...DEFAULT_RULES, ...extra.map(rule => ({ ...rule, source: "configured" as const }))],
    use, current);
}

export function allowedByRules(
  op: Op, path: string, rules: readonly ExclusionRule[], use?: ReadUse, current?: ReadEpoch, mode: PolicyMode = "folded",
): boolean {
  policyPath(path);
  const explicit = currentExplicit(op, path, use, current);
  if ((op === "read" || op === "model-send")
    && !(explicit || use?.kind === "routine-inventory" || use?.kind === "routine-search")) return false;
  const key = mode === "folded" ? policyKey : policyPath;
  const except = glob(DEFAULT_EXCEPTION.pattern).test(key(path));
  const kinds = new Set(rules.filter(rule => matches(rule.pattern, path, mode)
    && !(except && rule.source === "default-secret" && rule.pattern === ".env.?*")).flatMap(rule => rule.kinds));
  if (kinds.has("no-read")) return false;
  if (op === "read" && use?.kind === "explicit" && use.destination === "model" && kinds.has("no-model-send")) return false;
  switch (op) {
    case "scan": return !kinds.has("no-routine-scan");
    case "read": return !kinds.has("no-routine-scan") || explicit;
    case "model-send": return !kinds.has("no-model-send") && (!kinds.has("no-routine-scan") || explicit);
    case "edit": return !kinds.has("no-edit");
    case "export": return !kinds.has("no-export") && !kinds.has("no-model-send");
  }
}

/** A path matches a pattern exactly, as a directory prefix, or as a glob. */
export function matches(pattern: string, path: string, mode: PolicyMode = "folded"): boolean {
  const key = mode === "folded" ? policyKey : policyPath;
  const anchored = pattern.startsWith("/");
  pattern = key(anchored ? pattern.slice(1) : pattern);
  path = key(path);
  return path === pattern || path.startsWith(`${pattern}/`) || glob(pattern, anchored).test(path);
}
