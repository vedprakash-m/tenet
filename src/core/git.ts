import { spawn } from "node:child_process";

export type GitOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string | Uint8Array;
};

function runGit(args: string[], options: GitOptions = {}, binary = false): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["-c", "core.quotepath=false", ...args], {
      cwd: options.cwd ?? process.cwd(),
      env: { ...process.env, ...options.env },
      shell: false,
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      const output = Buffer.concat(stdout);
      if (code === 0) {
        resolve(output);
        return;
      }
      const message = Buffer.concat(stderr).toString("utf8").trim();
      const error = new Error(message || `git exited with code ${String(code)}`) as Error & {
        code: string | number | null;
        stdout: string | Buffer;
      };
      error.code = code;
      error.stdout = binary ? output : output.toString("utf8");
      reject(error);
    });
    if (options.input !== undefined) child.stdin.end(options.input);
    else child.stdin.end();
  });
}

export async function git(args: string[], options: GitOptions = {}): Promise<string> {
  if (!Array.isArray(args)) throw new TypeError("git arguments must be an array");
  return (await runGit(args, options, false)).toString("utf8");
}

function portablePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function batchName(ref: string, filename: string): string {
  if (!ref || filename.startsWith("/") || filename.split("/").includes("..")) {
    throw new Error(`invalid git batch path: ${filename}`);
  }
  return `${ref}:${portablePath(filename)}`;
}

export async function catFileBatch(
  ref: string,
  paths: string[],
  options: Omit<GitOptions, "input"> = {},
): Promise<Map<string, Buffer>> {
  if (paths.length === 0) return new Map();
  const requests = paths.map((filename) => batchName(ref, filename));
  const data = await runGit(["cat-file", "--batch"], { ...options, input: `${requests.join("\n")}\n` }, true);
  const result = new Map<string, Buffer>();
  let offset = 0;

  for (let index = 0; index < paths.length; index += 1) {
    const newline = data.indexOf(10, offset);
    if (newline < 0) throw new Error("incomplete git cat-file response");
    const header = data.subarray(offset, newline).toString("utf8");
    offset = newline + 1;
    if (header.endsWith(" missing")) {
      throw new Error(`git object is missing: ${requests[index]}`);
    }
    const match = /^(?:[0-9a-f]+) ([^ ]+) (\d+)$/.exec(header);
    if (!match) throw new Error(`invalid git cat-file header: ${header}`);
    const sizeText = match[2];
    if (sizeText === undefined) throw new Error(`invalid git cat-file size: ${header}`);
    const size = Number.parseInt(sizeText, 10);
    const end = offset + size;
    if (end > data.length || data[end] !== 10) throw new Error(`incomplete git blob: ${requests[index]}`);
    const filename = paths[index];
    if (filename === undefined) throw new Error("git batch path list changed");
    result.set(filename, Buffer.from(data.subarray(offset, end)));
    offset = end + 1;
  }
  return result;
}

export async function lastChangedMap(
  paths: string[],
  options: Omit<GitOptions, "input"> = {},
): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const portable = paths.map(portablePath);
  const data = await runGit(
    ["log", "--format=%x1e%H", "--name-only", "--no-renames", "-z", "--", ...portable],
    options,
    true,
  );
  const wanted = new Set(portable);
  const result = new Map<string, string>();
  let commit: string | undefined;

  for (const token of data.toString("utf8").split("\0")) {
    const clean = token.replace(/^[\r\n]+/, "");
    if (clean.startsWith("\u001e")) {
      const candidate = clean.slice(1);
      if (/^[0-9a-f]{40,64}$/.test(candidate)) commit = candidate;
      continue;
    }
    if (commit && wanted.has(clean) && !result.has(clean)) result.set(clean, commit);
  }
  return new Map(paths.flatMap((original) => {
    const changed = result.get(portablePath(original));
    return changed === undefined ? [] : [[original, changed] as const];
  }));
}

type TreeEntry = { mode: string; type: "blob" | "tree" | "commit"; oid: string };

function refIsValid(ref: string): boolean {
  return ref.startsWith("refs/") && !ref.endsWith("/") && !ref.includes("..") && !ref.includes(" ");
}

function parentDirectory(filename: string): string {
  const slash = filename.lastIndexOf("/");
  return slash < 0 ? "" : filename.slice(0, slash);
}

function baseName(filename: string): string {
  const slash = filename.lastIndexOf("/");
  return slash < 0 ? filename : filename.slice(slash + 1);
}

async function makeTree(
  directory: string,
  entries: Map<string, TreeEntry>,
  options: Omit<GitOptions, "input">,
): Promise<string> {
  const children = new Map<string, { entry?: TreeEntry; directory: boolean }>();
  const prefix = directory === "" ? "" : `${directory}/`;
  for (const [filename, entry] of entries) {
    if (!filename.startsWith(prefix)) continue;
    const remainder = filename.slice(prefix.length);
    if (!remainder) continue;
    const slash = remainder.indexOf("/");
    const name = slash < 0 ? remainder : remainder.slice(0, slash);
    if (slash < 0) children.set(name, { entry, directory: false });
    else if (!children.has(name)) children.set(name, { directory: true });
  }

  const lines: Buffer[] = [];
  for (const [name, child] of [...children].sort(([left], [right]) =>
    Buffer.compare(Buffer.from(left), Buffer.from(right)),
  )) {
    let mode: string;
    let type: "blob" | "tree" | "commit";
    let oid: string;
    if (child.directory) {
      mode = "040000";
      type = "tree";
      oid = await makeTree(directory === "" ? name : `${directory}/${name}`, entries, options);
    } else if (child.entry) {
      ({ mode, type, oid } = child.entry);
    } else {
      throw new Error(`missing tree entry: ${name}`);
    }
    lines.push(Buffer.from(`${mode} ${type} ${oid}\t${name}\0`, "utf8"));
  }
  const output = await runGit(["mktree", "-z"], { ...options, input: Buffer.concat(lines) });
  return output.toString("utf8").trim();
}

function commitEnvironment(now?: Date): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    GIT_AUTHOR_NAME: "Tenet",
    GIT_AUTHOR_EMAIL: "tenet@localhost",
    GIT_COMMITTER_NAME: "Tenet",
    GIT_COMMITTER_EMAIL: "tenet@localhost",
  };
  if (now) {
    const date = now.toISOString();
    env.GIT_AUTHOR_DATE = date;
    env.GIT_COMMITTER_DATE = date;
  }
  return env;
}

export async function writeRefFiles(
  ref: string,
  files: Record<string, string | Uint8Array>,
  message: string,
  options: Omit<GitOptions, "input" | "env"> & { now?: Date } = {},
): Promise<string> {
  if (!refIsValid(ref)) throw new Error(`invalid git ref: ${ref}`);
  const { now, ...gitOptions } = options;
  let parent: string | undefined;
  let oldRef: string | undefined;
  const entries = new Map<string, TreeEntry>();
  try {
    parent = (await git(["rev-parse", "--verify", ref], gitOptions)).trim();
    oldRef = parent;
  } catch {
    try {
      parent = (await git(["rev-parse", "--verify", "HEAD"], gitOptions)).trim();
    } catch {
      parent = undefined;
    }
  }
  if (parent) {
    const treeList = await runGit(["ls-tree", "-r", "-z", parent], gitOptions, true);
    for (const item of treeList.toString("utf8").split("\0")) {
      if (!item) continue;
      const match = /^(\d+) (blob|commit) ([0-9a-f]+)\t(.+)$/.exec(item);
      if (!match) throw new Error(`invalid git tree entry: ${item}`);
      const [, mode, type, oid, filename] = match;
      if (mode && (type === "blob" || type === "commit") && oid && filename) {
        entries.set(portablePath(filename), { mode, type, oid });
      }
    }
  }

  for (const [rawPath, contents] of Object.entries(files)) {
    const filename = portablePath(rawPath);
    if (!filename || filename.startsWith("/") || filename.split("/").includes("..")) {
      throw new Error(`invalid ref path: ${rawPath}`);
    }
    if (parentDirectory(filename).split("/").includes("..") || !baseName(filename)) {
      throw new Error(`invalid ref path: ${rawPath}`);
    }
    const oid = (
      await runGit(["hash-object", "-w", "--stdin"], { ...gitOptions, input: contents }, true)
    )
      .toString("utf8")
      .trim();
    entries.set(filename, { mode: "100644", type: "blob", oid });
  }

  const rootTree = await makeTree("", entries, gitOptions);
  const commitArgs = ["commit-tree", rootTree, "-F", "-"];
  if (parent) commitArgs.push("-p", parent);
  const commit = (
    await runGit(
      commitArgs,
      { ...gitOptions, env: commitEnvironment(now), input: message },
      true,
    )
  )
    .toString("utf8")
    .trim();
  await git(["update-ref", ref, commit, ...(oldRef ? [oldRef] : [])], gitOptions);
  return commit;
}
