import { defaultCaseFold } from "./unicode-case-fold.ts";

/** Git spelling remains separate from this lexical, normalized policy identity. */
export function policyPath(path: string): string {
  if (typeof path !== "string" || !path || path.includes("\0") || path.startsWith("/")
    || /^[a-z]:[\\/]/i.test(path) || path.startsWith("\\\\"))
    throw new TypeError("invalid workspace-relative policy path");
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "." || part === "") continue;
    if (part === "..") {
      if (!parts.length) throw new TypeError("policy path leaves the workspace");
      parts.pop();
    } else parts.push(part.normalize("NFC"));
  }
  if (!parts.length) throw new TypeError("policy path must name a workspace entry");
  return parts.join("/");
}

/** Without authenticated volume evidence every consumer uses the conservative folded mode. */
export const policyKey = (path: string): string => defaultCaseFold(policyPath(path));
