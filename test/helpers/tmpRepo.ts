import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type TemporaryRepository = {
  path: string;
  git(args: string[], input?: string | Uint8Array): string;
  write(relative: string, contents: string | Uint8Array): Promise<void>;
  cleanup(): Promise<void>;
};

const testRoot = path.resolve(".test-tmp", String(process.pid));

// A temporary repository whose .git vanished must never fall through to this
// project's own repository: git stops searching at the test root.
process.env.GIT_CEILING_DIRECTORIES = [path.dirname(testRoot), process.env.GIT_CEILING_DIRECTORIES]
  .filter(Boolean)
  .join(path.delimiter);

function run(args: string[], cwd: string, input?: string | Uint8Array): string {
  const child = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    input,
    shell: false,
    windowsHide: true,
  });
  if (child.status !== 0) throw new Error(child.stderr || `git ${args[0]} failed`);
  return child.stdout;
}

export async function tmpRepo(label = "repo"): Promise<TemporaryRepository> {
  await mkdir(testRoot, { recursive: true });
  const directory = await mkdtemp(path.join(testRoot, `${label}-${randomUUID().slice(0, 8)}-`));
  run(["init", "--quiet"], directory);
  run(["config", "user.name", "Tenet Test"], directory);
  run(["config", "user.email", "tenet-test@example.invalid"], directory);
  run(["config", "core.autocrlf", "false"], directory);
  run(["config", "core.safecrlf", "false"], directory);

  return {
    path: directory,
    git: (args, input) => run(args, directory, input),
    async write(relative, contents) {
      const filename = path.join(directory, ...relative.replaceAll("\\", "/").split("/"));
      await mkdir(path.dirname(filename), { recursive: true });
      await writeFile(filename, contents);
    },
    async cleanup() {
      await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    },
  };
}

export async function cleanupTestRoot(): Promise<void> {
  await rm(testRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
