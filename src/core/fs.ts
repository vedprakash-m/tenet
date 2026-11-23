import { randomBytes } from "node:crypto";
import { lstat, mkdir, open, realpath, rename, rm } from "node:fs/promises";
import path from "node:path";

const retryableRenameCodes = new Set(["EPERM", "EBUSY", "EACCES"]);

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function nearestExisting(target: string): Promise<string> {
  let current = target;
  for (;;) {
    try {
      await lstat(current);
      return current;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      current = parent;
    }
  }
}

function pathEscape(value: string): Error & { code: string } {
  const error = new Error(`TN-PATH-ESCAPE: path is outside the repository: ${value}`) as Error & {
    code: string;
  };
  error.code = "TN-PATH-ESCAPE";
  return error;
}

export async function confine(value: string, root = process.cwd()): Promise<string> {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) throw pathEscape(value);

  const portable = value.replaceAll("\\", "/");
  if (path.posix.isAbsolute(portable) || path.win32.isAbsolute(value) || portable.startsWith("//")) {
    throw pathEscape(value);
  }
  const parts = portable.split("/");
  if (parts.includes("..")) throw pathEscape(value);

  const lexicalRoot = path.resolve(root);
  const target = path.resolve(lexicalRoot, ...parts.filter((part) => part !== "" && part !== "."));
  if (!isWithin(lexicalRoot, target)) throw pathEscape(value);

  let rootReal: string;
  try {
    rootReal = await realpath(lexicalRoot);
  } catch {
    throw pathEscape(value);
  }

  const existing = await nearestExisting(target);
  const existingReal = await realpath(existing);
  if (!isWithin(rootReal, existingReal)) throw pathEscape(value);

  if (existing !== target) {
    const suffix = path.relative(existing, target);
    const resolved = path.resolve(existingReal, suffix);
    if (!isWithin(rootReal, resolved)) throw pathEscape(value);
  }

  return target.replaceAll(path.sep, "/");
}

export async function writeAtomic(
  filename: string,
  value: string | NodeJS.ArrayBufferView,
  options: {
    mode?: number;
    renameFile?: typeof rename;
    retryDelay?: (milliseconds: number) => Promise<void>;
  } = {},
): Promise<void> {
  const parent = path.dirname(filename);
  await mkdir(parent, { recursive: true });
  const temporary = path.join(
    parent,
    `.${path.basename(filename)}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`,
  );
  let handle: Awaited<ReturnType<typeof open>> | undefined;

  try {
    handle = await open(temporary, "wx", options.mode);
    await handle.writeFile(value);
    await handle.sync();
    await handle.close();
    handle = undefined;

    const renameFile = options.renameFile ?? rename;
    const retryDelay = options.retryDelay ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        await renameFile(temporary, filename);
        return;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (!retryableRenameCodes.has(code ?? "") || attempt >= 5) throw error;
        await retryDelay(10 * (attempt + 1));
      }
    }
  } catch (error) {
    if (handle) await handle.close().catch(() => undefined);
    await rm(temporary, { force: true });
    throw error;
  }
}
