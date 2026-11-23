import { message } from "../core/messages.js";
import { readFile, readdir } from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";
import { confine } from "../core/fs.js";
import { catFileBatch, git } from "../core/git.js";
import { sha256 } from "../core/hash.js";
import { readYaml } from "../core/yaml.js";
import { validate } from "../core/schema.js";
import type { Lock } from "../types/generated.js";
import { policyError } from "./errors.js";
import { contextForPolicy, loadPolicy } from "./load.js";
import type { Policy, PolicyOptions } from "./types.js";

export type LoadedKit = {
  path: string;
  sha256: string;
};

export type LockVerification = LoadedKit & {
  ok: true;
  skipped: boolean;
  lock_sha256: string | null;
};

function parseYamlText(text: string, filename: string): unknown {
  const document = parseDocument(text, {
    merge: false,
    prettyErrors: true,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    const cause = document.errors[0] ?? new Error(`cannot parse YAML: ${filename}`);
    throw policyError("TN-LOCK-INVALID", { message: `${filename} is not valid YAML: ${cause.message}`, fix: "Fix the lock file." });
  }
  return document.toJS({ maxAliasCount: 100 });
}

async function filesInDirectory(root: string, relative = ""): Promise<Array<{ name: string; contents: Buffer }>> {
  const directory = path.join(root, ...relative.split("/").filter(Boolean));
  let entries: Dirent[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw policyError("TN-KIT-MISSING", { message: `The kit is missing at ${root}.`, fix: "Install Tenet or fix kit_path." });
    }
    throw error;
  }

  const files: Array<{ name: string; contents: Buffer }> = [];
  for (const entry of entries) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await filesInDirectory(root, name)));
    } else if (entry.isFile()) {
      files.push({ name, contents: await readFile(path.join(root, ...name.split("/"))) });
    } else {
      throw policyError(
        "TN-KIT-INVALID",
        {
          message: `The kit contains an unsupported file at ${name}.`,
          fix: "Replace symbolic links and special files with regular files.",
        },
      );
    }
  }
  return files;
}

async function filesAtRef(
  ref: string,
  relativeRoot: string,
  cwd: string,
): Promise<Array<{ name: string; contents: Buffer }>> {
  const listed = await git(["ls-tree", "-r", "-z", "--name-only", ref, "--", relativeRoot], { cwd });
  const paths = listed
    .split("\0")
    .filter(Boolean)
    .filter((filename) => filename.startsWith(`${relativeRoot}/`));
  if (paths.length === 0) {
    throw policyError(
      "TN-KIT-MISSING",
      {
        message: `The kit is missing at ${relativeRoot} in ${ref}.`,
        fix: "Add the vendored kit or choose another target.",
      },
    );
  }
  const blobs = await catFileBatch(ref, paths, { cwd });
  return paths.map((filename) => {
    const contents = blobs.get(filename);
    if (!contents) throw policyError("TN-KIT-INVALID", { message: `Cannot read ${filename} from ${ref}.`, fix: "Repair the git tree." });
    return { name: filename.slice(relativeRoot.length + 1), contents };
  });
}

function kitDigest(files: Array<{ name: string; contents: Buffer }>): string {
  const lines = files
    .map((file) => ({ name: file.name.replaceAll("\\", "/"), contents: file.contents }))
    .sort((left, right) => Buffer.compare(Buffer.from(left.name, "utf8"), Buffer.from(right.name, "utf8")))
    .map((file) => `${file.name}\0${sha256(file.contents)}`);
  return sha256(lines.join("\n"));
}

function installedKitPath(): string {
  return fileURLToPath(new URL("../../kit/", import.meta.url));
}

export async function loadKit(policy: Policy): Promise<LoadedKit> {
  const context = contextForPolicy(policy);
  if (!policy.kit_path) {
    const kitPath = installedKitPath();
    return { path: kitPath, sha256: kitDigest(await filesInDirectory(kitPath)) };
  }

  const kitPath = await confine(policy.kit_path, context.cwd);
  if (context.ref) {
    const relative = policy.kit_path.replaceAll("\\", "/").replace(/^\.\/+/, "");
    return {
      path: kitPath,
      sha256: kitDigest(await filesAtRef(context.ref, relative, context.cwd)),
    };
  }
  return { path: kitPath, sha256: kitDigest(await filesInDirectory(kitPath)) };
}

async function readLock(policy: Policy): Promise<Lock> {
  const context = contextForPolicy(policy);
  let data: unknown;
  if (context.ref) {
    try {
      data = parseYamlText(await git(["show", `${context.ref}:tenet.lock`], { cwd: context.cwd }), "tenet.lock");
    } catch (error) {
      if (typeof (error as { code?: unknown }).code === "string") throw error;
      throw policyError(
        "TN-LOCK-MISSING",
        {
          message: `tenet.lock is missing at ${context.ref}.`,
          fix: "Run tenet init to create and pin the lock file.",
        },
        { file: "tenet.lock" },
      );
    }
  } else {
    try {
      data = await readYaml(path.join(context.cwd, "tenet.lock"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw policyError(
          "TN-LOCK-MISSING",
          {
            message: "tenet.lock is missing.",
            fix: "Run tenet init to create and pin the lock file.",
          },
          { file: "tenet.lock" },
        );
      }
      throw policyError(
        "TN-LOCK-INVALID",
        {
          message: `tenet.lock cannot be read: ${(error as Error).message}`,
          fix: "Fix the lock file syntax.",
        },
        { file: "tenet.lock" },
      );
    }
  }

  const checked = validate("lock", data);
  if (!checked.ok) {
    const detail = checked.errors.map((error) => `${error.pointer || "/"} ${error.message}`).join("; ");
    throw policyError(
      "TN-LOCK-INVALID",
      {
        message: `tenet.lock does not match its schema: ${detail}`,
        fix: "Regenerate tenet.lock with the installed Tenet version.",
      },
      { file: "tenet.lock" },
    );
  }
  return data as Lock;
}

export async function verifyLock(options: PolicyOptions = {}): Promise<LockVerification> {
  const policy = await loadPolicy(options);
  const kit = await loadKit(policy);
  if (policy.kit_path === "kit") {
    return { ok: true, ...kit, skipped: true, lock_sha256: null };
  }

  const lock = await readLock(policy);
  if (lock.kit_sha256 !== kit.sha256) {
    throw policyError(
      "TN-LOCK-MISMATCH",
      message("TN-KIT-EDITED", { actual: kit.sha256, expected: lock.kit_sha256 }),
      { file: policy.kit_path ?? "tenet.lock" },
    );
  }

  const packageFile = fileURLToPath(new URL("../../package.json", import.meta.url));
  const manifest = JSON.parse(await readFile(packageFile, "utf8")) as { version?: unknown };
  const version = typeof manifest.version === "string" ? manifest.version : "0.0.0";
  if (lock.version !== version) {
    throw policyError(
      "TN-LOCK-MISMATCH",
      message("TN-LOCK-MISMATCH", { installed: version, locked: lock.version }),
      { file: "tenet.lock" },
    );
  }
  return { ok: true, ...kit, skipped: false, lock_sha256: lock.kit_sha256 };
}
