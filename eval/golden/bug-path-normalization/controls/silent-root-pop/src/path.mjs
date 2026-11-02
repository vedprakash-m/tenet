export function normalizeRelative(path) {
  if (typeof path !== "string" || path.startsWith("/") || /[\\:\0]/.test(path)) throw new TypeError("relative slash path required");
  const parts = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop(); else parts.push(part);
  }
  return parts.join("/");
}
