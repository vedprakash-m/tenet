// The project folder as an adapter: the only code that writes files the user will see. Never overwrites.
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import type { Project, RecipeFile } from "../ports/types.ts";

const lexists = (p: string): boolean => { try { lstatSync(p); return true; } catch { return false; } };

export class FsProject implements Project {
  private root: string;
  constructor(root: string) { this.root = resolve(root); }

  /** A path inside the project, or an error: a recipe can never write outside the folder it was asked to fill, and a symlink that leads out is outside. */
  private at(rel: string): string {
    const p = resolve(this.root, rel);
    if (p !== this.root && !p.startsWith(this.root + sep)) throw new Error(`path escapes the project: ${rel}`);
    let probe = p;
    while (!lexists(probe) && probe !== this.root) probe = dirname(probe); // the nearest part that exists decides where a new file would land
    let real: string;
    try { real = realpathSync(probe); } catch { throw new Error(`path cannot be resolved (a link that leads nowhere?): ${rel}`); }
    const home = realpathSync(this.root);
    if (real !== home && !real.startsWith(home + sep)) throw new Error(`path leaves the project through a link: ${rel}`);
    return p;
  }

  writeNew(files: readonly RecipeFile[]): void {
    for (const f of files) {
      const p = this.at(f.path);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, f.content, { flag: "wx", mode: f.mode });
    }
  }

  hashes(paths: readonly string[]): Record<string, string | null> {
    return Object.fromEntries(paths.map((rel) => {
      try { return [rel, createHash("sha256").update(readFileSync(this.at(rel))).digest("hex")]; } catch { return [rel, null]; }
    }));
  }

  read(rel: string): string | null {
    try { return readFileSync(this.at(rel), "utf8"); } catch { return null; }
  }

  write(rel: string, content: string): void {
    const p = this.at(rel);
    mkdirSync(dirname(p), { recursive: true });
    const tmp = `${p}.tenet-${process.pid}.tmp`;
    writeFileSync(tmp, content);
    renameSync(tmp, p);
  }

  remove(paths: readonly string[]): void { for (const rel of paths) rmSync(this.at(rel), { force: true }); }
}

