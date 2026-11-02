export function normalizeRelative(path) {
  if (typeof path !== "string" || path.startsWith("/") || /[\\:\0]/.test(path)) throw new TypeError("relative slash path required");
  return path.split("/").filter(part => part && part !== "." && part !== "..").join("/");
}
