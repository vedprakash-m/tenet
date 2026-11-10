// Sharing installed dependencies with a sealed copy of the starting files (EVD-04, TS §9.8, sealed-baseline spec finding 7).
// The workspace's `node_modules` is linked only when the starting manifest and lockfile are the ones installed now, there are
// no package workspaces, and no top-level package resolves inside the workspace; otherwise the result is unknown, never guessed.
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, symlinkSync } from "node:fs";
import { join, sep } from "node:path";

const LOCKS = ["package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock"];
const UNSAFE = "sealed-deps-unavailable";

const same = (a: string, b: string): boolean =>
  existsSync(a) === existsSync(b) && (!existsSync(a) || readFileSync(a).equals(readFileSync(b)));

/** Top-level packages (and scoped ones) that are links into the workspace itself. */
function linksInside(modules: string, root: string): boolean {
  const entries = readdirSync(modules).flatMap((n) => n.startsWith("@") ? readdirSync(join(modules, n)).map((m) => `${n}/${m}`) : [n]);
  return entries.some((n) => {
    const p = join(modules, n);
    return lstatSync(p).isSymbolicLink() && `${realpathSync(p)}${sep}`.startsWith(`${root}${sep}`);
  });
}

export function shareDeps(root: string, sealedRoot: string): string | undefined {
  try {
    const manifest = join(sealedRoot, "package.json");
    if (!existsSync(manifest) || JSON.parse(readFileSync(manifest, "utf8")).workspaces) return UNSAFE;
    if (!LOCKS.some((l) => existsSync(join(sealedRoot, l)))) return UNSAFE;
    if (!["package.json", ...LOCKS].every((n) => same(join(sealedRoot, n), join(root, n)))) return UNSAFE;
    const modules = realpathSync(join(root, "node_modules")), real = realpathSync(root);
    if (linksInside(modules, real)) return UNSAFE;
    symlinkSync(modules, join(sealedRoot, "node_modules"), process.platform === "win32" ? "junction" : "dir");
    return undefined;
  } catch {
    return UNSAFE;
  }
}
