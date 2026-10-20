// Recipes ship inside the plugin: `skills/tenet-starter-<id>/recipe.json` and a `template/` folder beside the kernel.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { Recipe, RecipeFile, Recipes } from "../ports/types.ts";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? (f === "node_modules" ? [] : walk(join(dir, f))) : [join(dir, f)]));
}

export class FsRecipes implements Recipes {
  private pluginRoot: string;
  constructor(pluginRoot: string) { this.pluginRoot = pluginRoot; }

  text(rel: string): string | null {
    try { return readFileSync(join(this.pluginRoot, rel), "utf8"); } catch { return null; }
  }

  load(id: string): Recipe | null {
    const dir = join(this.pluginRoot, "skills", `tenet-starter-${id}`);
    if (!existsSync(join(dir, "recipe.json"))) return null;
    const meta = JSON.parse(readFileSync(join(dir, "recipe.json"), "utf8")) as Omit<Recipe, "files">;
    const files: RecipeFile[] = walk(join(dir, "template")).map((p) => ({
      path: relative(join(dir, "template"), p), content: readFileSync(p, "utf8"), mode: statSync(p).mode & 0o111 ? 0o755 : 0o644,
    }));
    return { ...meta, files: files.sort((a, b) => (a.path < b.path ? -1 : 1)) };
  }
}
