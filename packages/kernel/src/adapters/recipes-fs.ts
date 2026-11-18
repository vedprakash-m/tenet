// Recipes ship inside the plugin: `skills/tenet-starter-<id>/recipe.json` and a `template/` folder beside the kernel.
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { z } from "zod";
import { sha256, stableStringify } from "../core/ids.ts";
import { coverageDefinitionHash } from "../core/alternative-check.ts";
import { redact } from "../core/redact.ts";
import { KernelError } from "../core/errors.ts";
import { ReviewResult } from "../core/schemas.ts";
import type { Recipe, RecipeCoverage, RecipeCoverageCheck, RecipeFile, Recipes } from "../ports/types.ts";

const HASH = z.string().regex(/^[a-f0-9]{64}$/);
const ID = z.string().regex(/^[A-Za-z0-9._-]{1,64}$/);
const TAG = z.string().regex(/^COV-[a-z0-9-]{1,48}$/);
const Check = z.strictObject({
  tool: z.enum(["vitest", "playwright"]),
  config: z.string().min(1).max(300),
  file: z.string().min(1).max(300),
  tag: TAG,
  support: z.array(z.string().min(1).max(300)).max(1000).default([]),
});
const RawCoverage = z.strictObject({
  id: ID,
  obligation: z.string().regex(/^OB-[A-Za-z0-9._-]{1,64}$/),
  property: z.string().min(1).max(500),
  population: z.string().min(1).max(500),
  primary: Check,
  alternative: Check,
  review: z.string().min(1).max(300),
});
const RawRecipe = z.strictObject({
  id: z.string().min(1), version: z.string().min(1), sentinel: z.string().min(1),
  lockfileSha256: HASH, protectedPaths: z.array(z.string()).max(200),
  install: z.array(z.array(z.string().min(1)).min(1)).max(20),
  checks: z.array(z.enum(["tsc", "eslint", "e2e", "workload"])).optional(),
  coverage: z.array(RawCoverage).max(8).optional(),
});
const RawReview = z.strictObject({
  version: z.literal(1),
  mappingHash: HASH,
  primaryFileHash: HASH,
  alternativeFileHash: HASH,
  primaryConfigHash: HASH,
  alternativeConfigHash: HASH,
  primaryDefinitionHash: HASH,
  alternativeDefinitionHash: HASH,
  review: ReviewResult,
});

const safePath = (path: string): boolean =>
  !!path && !path.includes("\0") && !isAbsolute(path) && !path.split(/[\\/]/).some((part) => !part || part === "." || part === "..");
const parseJson = (text: string, what: string): unknown => {
  try { return JSON.parse(text); } catch (error) {
    throw new KernelError("adapter-unsupported-config", `${what} is not valid JSON: ${(error as Error).message}`, { exit: 2 });
  }
};
const parse = <T>(schema: z.ZodType<T>, value: unknown, what: string): T => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const problem = parsed.error.issues[0]?.message ?? "invalid record";
    throw new KernelError("adapter-unsupported-config", `${what}: ${problem}`, { exit: 2 });
  }
  return parsed.data;
};
function admitReview(review: z.infer<typeof RawReview>, expected: Record<string, string>): void {
  if (review.review.manifest !== sha256(stableStringify(expected)) ||
      review.review.dispatchMode !== "subagent-fresh" ||
      review.review.status !== "completed" ||
      review.review.axes.behavior !== "pass" ||
      review.review.axes.structure !== "pass" ||
      review.review.coverage.uncovered.length ||
      review.review.findings.length ||
      review.review.basisGaps.length ||
      (review.review.openDependencies?.length ?? 0)) {
    throw new KernelError("adapter-unsupported-config", "coverage review is not an approved completed result", { exit: 2 });
  }
}

function loadCoverageReview(
  dir: string,
  path: string,
  expected: Record<string, string>,
): { review: RecipeCoverage["review"]; reviewHash: string } {
  const reviewPath = join(dir, path);
  const reviewText = readRegular(reviewPath, "coverage review");
  const review = parse(RawReview, parseJson(reviewText, path), path);
  for (const [key, value] of Object.entries(expected)) {
    if ((review as Record<string, unknown>)[key] !== value) {
      throw new KernelError("adapter-unsupported-config", `coverage review does not bind ${key}`, { exit: 2 });
    }
  }
  admitReview(review, expected);
  return {
    review: {
      path,
      independence: "subagent-fresh",
      reservation: review.review.reservation,
      manifestHash: review.review.manifest,
      status: "completed",
      disposition: "approved",
      mappingHash: review.mappingHash,
      primaryFileHash: review.primaryFileHash,
      alternativeFileHash: review.alternativeFileHash,
      primaryConfigHash: review.primaryConfigHash,
      alternativeConfigHash: review.alternativeConfigHash,
    },
    reviewHash: sha256(reviewText),
  };
}
const readRegular = (path: string, what: string): string => {
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new KernelError("adapter-unsupported-config", `${what} is not a regular file`, { exit: 2 });
    return readFileSync(path, "utf8");
  } catch (error) {
    if (error instanceof KernelError) throw error;
    const code = (error as NodeJS.ErrnoException).code;
    if (["ENOENT", "EACCES", "EPERM", "ELOOP"].includes(code ?? "")) {
      throw new KernelError("adapter-unsupported-config", `${what} is unavailable: ${code}`, { exit: 2 });
    }
    throw error;
  }
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) =>
    statSync(join(dir, f)).isDirectory() ? (f === "node_modules" ? [] : walk(join(dir, f))) : [join(dir, f)]
  );
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
    const meta = parse(RawRecipe, parseJson(readFileSync(join(dir, "recipe.json"), "utf8"), "recipe.json"), "recipe.json");
    const files: RecipeFile[] = walk(join(dir, "template")).map((p) => ({
      path: relative(join(dir, "template"), p), content: readFileSync(p, "utf8"), mode: statSync(p).mode & 0o111 ? 0o755 : 0o644,
    }));
    const sorted = files.sort((a, b) => (a.path < b.path ? -1 : 1));
    const { coverage: rawCoverage, ...recipe } = meta;
    const mappingIds = (rawCoverage ?? []).map((mapping) => mapping.id);
    const obligationIds = (rawCoverage ?? []).map((mapping) => mapping.obligation);
    const roleIds = [...obligationIds, ...obligationIds.map((id) => `${id}-alternative`)];
    if (new Set(mappingIds).size !== mappingIds.length ||
        new Set(roleIds).size !== roleIds.length) {
      throw new KernelError("adapter-unsupported-config", "coverage IDs and obligations must be unique", { exit: 2 });
    }
    const coverage = (rawCoverage ?? []).map((mapping): RecipeCoverage => this.coverage(dir, mapping, sorted));
    return { ...recipe, files: sorted, ...(coverage.length ? { coverage } : {}) };
  }

  private coverage(
    dir: string,
    raw: z.infer<typeof RawCoverage>,
    files: readonly RecipeFile[],
  ): RecipeCoverage {
    if (raw.primary.tool === raw.alternative.tool) {
      throw new KernelError("adapter-unsupported-config", "coverage checks need distinct Vitest and Playwright producers", { exit: 2 });
    }
    if (redact(raw.property) !== raw.property || redact(raw.population) !== raw.population) {
      throw new KernelError("adapter-unsupported-config", "coverage metadata looks like secret material", { exit: 2 });
    }
    for (const role of [raw.primary, raw.alternative]) {
      if (!safePath(role.config) || !safePath(role.file)) {
        throw new KernelError("adapter-unsupported-config", "coverage paths must stay inside the recipe", { exit: 2 });
      }
      const hasConfig = files.some((f) => f.path.split("\\").join("/") === role.config);
      const hasFile = files.some((f) => f.path.split("\\").join("/") === role.file);
      if (!hasConfig || !hasFile) {
        throw new KernelError("adapter-unsupported-config", `coverage input is missing: ${role.file}`, { exit: 2 });
      }
      for (const path of [role.config, role.file]) {
        const stat = lstatSync(join(dir, "template", path));
        if (!stat.isFile() || stat.isSymbolicLink()) {
          throw new KernelError("adapter-unsupported-config", `coverage input is not a regular file: ${path}`, { exit: 2 });
        }
      }
    }
    if (!safePath(raw.review)) throw new KernelError("adapter-unsupported-config", "coverage review path is invalid", { exit: 2 });
    const fileHash = (path: string) => sha256(files.find((f) => f.path.split("\\").join("/") === path)!.content);
    const expandSupport = (roots: readonly string[]) => [...new Set(files
      .map((file) => file.path.split("\\").join("/"))
      .filter((path) => roots.some((root) => path === root || path.startsWith(`${root}/`)))
    )].sort();
    const primary = { ...raw.primary, support: expandSupport(raw.primary.support) };
    const alternative = { ...raw.alternative, support: expandSupport(raw.alternative.support) };
    const supportHashes = (role: RecipeCoverageCheck) =>
      Object.fromEntries(role.support.map((path) => [path, fileHash(path)]));
    const definitionHash = (role: RecipeCoverageCheck) =>
      coverageDefinitionHash(
        role, fileHash(role.config), fileHash(role.file), supportHashes(role),
      );
    const mappingHash = sha256(stableStringify(raw));
    const primaryDefinitionHash = definitionHash(primary);
    const alternativeDefinitionHash = definitionHash(alternative);
    const expected = {
      mappingHash,
      primaryFileHash: fileHash(raw.primary.file), alternativeFileHash: fileHash(raw.alternative.file),
      primaryConfigHash: fileHash(raw.primary.config), alternativeConfigHash: fileHash(raw.alternative.config),
      primaryDefinitionHash, alternativeDefinitionHash,
    };
    const loadedReview = loadCoverageReview(dir, raw.review, expected);
    return {
      ...raw,
      primary,
      alternative,
      review: loadedReview.review,
      mappingHash,
      reviewHash: loadedReview.reviewHash,
      primaryDefinitionHash,
      alternativeDefinitionHash,
    };
  }
}
