// Redaction of likely secrets (SEC-11). Pure. A heuristic, not a guarantee: it removes the common shapes of keys, tokens,
// private keys, URL credentials and credential assignments from what Tenet displays and records, and leaves names,
// hashes and identifiers alone. What it misses stays visible, so the claim is "likely secrets", never "no secrets".
const MARK = "[redacted]";
const VALUE = String.raw`(?=[^\s"',;]*[\d_+/=-])[^\s"',;]{8,}`; // an assigned value that looks like one: it holds a digit or symbol

const PATTERNS: Array<[RegExp, string]> = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, "[redacted private key]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, MARK],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, MARK],
  [/\bsk-[A-Za-z0-9_-]{20,}\b/g, MARK],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, MARK],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, MARK],
  [/\b(Bearer\s+)[A-Za-z0-9._~+/-]{20,}=*/gi, `$1${MARK}`],
  [/(\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:)[^\s@/]+@/gi, `$1${MARK}@`],
  [new RegExp(String.raw`(\b\w*(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)\w*\s*[:=]\s*["']?)${VALUE}`, "gi"), `$1${MARK}`],
];

export const redact = (s: string): string => PATTERNS.reduce((t, [re, to]) => t.replace(re, to), s);

/** The same value with every string redacted; objects and arrays are copied, other values pass through. */
export function redactDeep<T>(v: T): T {
  if (typeof v === "string") return redact(v) as T;
  if (Array.isArray(v)) return v.map(redactDeep) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, redactDeep(x)])) as T;
  return v;
}
