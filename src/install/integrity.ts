import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { message } from "../core/messages.js";
import { fail } from "../core/output.js";
import type { PreflightOptions } from "./types.js";

const integrityPattern = /^sha512-[A-Za-z0-9+/]{86}==$/;

export type ReleaseIntegrity = {
  package: string;
  version: string;
  integrity: string;
  warning?: string;
};

function invalid(detail: string): never {
  const words = message("TN-LOCK-INVALID", { detail });
  const finding = { ...fail("TN-LOCK-INVALID", words.message, words.fix), file: "tenet.lock" };
  throw Object.assign(new Error(words.message), {
    code: "TN-LOCK-INVALID",
    finding,
  });
}

function registryUnavailable(
  packageName: string,
  version: string,
  detail: string,
  command: "init" | "upgrade",
): never {
  const cause = /ERR_SSL|TLS|SSL/i.test(detail)
    ? "the TLS or proxy handshake failed"
    : /ETIMEDOUT|timeout/i.test(detail)
      ? "the npm request timed out"
      : /ECONNREFUSED|ENETUNREACH|EAI_AGAIN/i.test(detail)
        ? "the registry could not be reached"
        : /E404|404|not found/i.test(detail)
          ? "the package is not available on this registry"
          : "the npm registry request failed";
  const words = message("TN-ENV-REGISTRY", {
    package: packageName,
    version,
    cause,
    command,
  });
  const finding = { ...fail("TN-ENV-REGISTRY", words.message, words.fix), detail };
  throw Object.assign(new Error(words.message), {
    code: "TN-ENV-REGISTRY",
    finding,
  });
}

function validateIntegrity(value: unknown, source: string): string {
  if (typeof value !== "string" || !integrityPattern.test(value)) {
    invalid(`${source} did not supply a valid sha512 integrity value.`);
  }
  return value;
}

async function installedPackage(): Promise<{ package: string; version: string; root: string }> {
  const root = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
  const source = path.join(root, "package.json");
  let value: { name?: unknown; version?: unknown };
  try {
    value = JSON.parse(await readFile(source, "utf8")) as typeof value;
  } catch (error) {
    invalid(`The installed package metadata at ${source} could not be read: ${(error as Error).message}`);
  }
  if (typeof value.name !== "string" || !value.name || typeof value.version !== "string" || !value.version) {
    invalid(`The installed package metadata at ${source} is missing a package name or version.`);
  }
  return { package: value.name, version: value.version, root };
}

export async function installedPackageVersion(): Promise<string> {
  return (await installedPackage()).version;
}

async function listFiles(root: string, relative = ""): Promise<string[]> {
  const directory = path.join(root, ...relative.split("/").filter(Boolean));
  const entries = await readdir(directory, { withFileTypes: true }).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  });
  const files: string[] = [];
  for (const entry of entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)) {
    const item = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(root, item));
    else if (entry.isFile()) files.push(item);
  }
  return files;
}

async function localIntegrity(root: string): Promise<string> {
  const files = new Set<string>(["package.json", "LICENSE", "README.md"]);
  for (const directory of ["dist", "kit", "pkg/migrations", "pkg/conformance", "pkg/hosts"]) {
    for (const item of await listFiles(root, directory)) files.add(item);
  }
  const hash = createHash("sha512");
  for (const relative of [...files].sort()) {
    let bytes: Buffer;
    try {
      bytes = await readFile(path.join(root, ...relative.split("/")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    hash.update(relative);
    hash.update("\0");
    hash.update(bytes);
  }
  return `sha512-${hash.digest("base64")}`;
}

export async function installedLocalIntegrity(): Promise<string> {
  const installed = await installedPackage();
  return localIntegrity(installed.root);
}

type NpmViewResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

type NpmViewRunner = (
  args: string[],
  options: { cwd: string },
) => Promise<NpmViewResult>;

export async function runNpmView(args: string[], options: { cwd: string }): Promise<NpmViewResult> {
  let executable = "npm";
  let prefix: string[] = [];
  if (process.platform === "win32") {
    executable = process.execPath;
    const npmExecPath = process.env.npm_execpath;
    if (typeof npmExecPath === "string" && /(?:^|[\\/])npm-cli\.js$/i.test(npmExecPath)) {
      prefix = [npmExecPath];
    } else {
      prefix = [path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")];
    }
  }
  const child = spawn(executable, [...prefix, ...args], {
    cwd: options.cwd,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    shell: false,
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
  const status = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  return { status, stdout, stderr };
}

async function registryIntegrity(
  packageName: string,
  version: string,
  cwd: string,
  run: NpmViewRunner = runNpmView,
  command: "init" | "upgrade" = "init",
): Promise<string | null> {
  const args = [
    "view",
    `${packageName}@${version}`,
    "dist.integrity",
    "--json",
    "--registry=https://registry.npmjs.org/",
  ];
  const { status, stdout, stderr } = await run(args, { cwd });
  if (status !== 0) {
    if (/E404|404 Not Found|is not in this registry|No match found/i.test(`${stdout}\n${stderr}`)) return null;
    registryUnavailable(
      packageName,
      version,
      stderr.trim() || `npm exited ${String(status)}`,
      command,
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(stdout);
  } catch {
    invalid(`The registry response for ${packageName}@${version} was not valid JSON.`);
  }
  return validateIntegrity(value, `The registry response for ${packageName}@${version}`);
}

export function localIntegrityWarning(packageName: string, version: string, offline = false): string {
  if (offline) {
    return `Registry not checked (offline), so Tenet used local package integrity for ${packageName}@${version}. ` +
      "CI workflows cannot verify it until `tenet upgrade` is run while online.";
  }
  return `${packageName}@${version} is not on the registry, so Tenet used local package integrity. ` +
    "CI workflows cannot verify it until the package is published and re-pinned with `tenet upgrade`.";
}

type IntegrityDependencies = {
  registry?: (packageName: string, version: string) => Promise<string | null>;
  npmView?: NpmViewRunner;
};

export async function releaseIntegrity(
  options: PreflightOptions,
  dependencies: IntegrityDependencies = {},
  command: "init" | "upgrade" = "init",
): Promise<ReleaseIntegrity> {
  const installed = await installedPackage();
  const environment = options.environment ?? {};
  const packageName = environment.registry?.package ?? installed.package;
  const version = environment.installedVersion ?? installed.version;
  const configured = environment.registry?.releases?.[version]?.integrity;
  const override = process.env.TENET_INSTALL_INTEGRITY;
  if (configured !== undefined) {
    return {
      package: packageName,
      version,
      integrity: validateIntegrity(configured, `Configured registry metadata for ${packageName}@${version}`),
    };
  }
  if (override !== undefined) {
    return {
      package: packageName,
      version,
      integrity: validateIntegrity(override, `TENET_INSTALL_INTEGRITY for ${packageName}@${version}`),
    };
  }
  const local = options.offline === true || version === "0.0.0";
  let registry: string | null = null;
  if (!local) {
    const injected = process.env.TENET_TEST_REGISTRY_INTEGRITY;
    const injectedError = process.env.TENET_TEST_REGISTRY_ERROR;
    let supplied: string | null;
    try {
      if (injectedError !== undefined) throw new Error(injectedError);
      supplied = injected === "not-found"
        ? null
        : injected !== undefined
          ? injected
          : dependencies.registry
            ? await dependencies.registry(packageName, version)
            : await registryIntegrity(
              packageName,
              version,
              installed.root,
              dependencies.npmView,
              command,
            );
    } catch (error) {
      if (["TN-LOCK-INVALID", "TN-ENV-REGISTRY"].includes(
        (error as { code?: string }).code ?? "",
      )) {
        throw error;
      }
      registryUnavailable(packageName, version, (error as Error).message, command);
    }
    registry = supplied === null
      ? null
      : validateIntegrity(supplied, "Injected registry metadata");
  }
  if (registry) return { package: packageName, version, integrity: registry };
  return {
    package: packageName,
    version,
    integrity: await localIntegrity(installed.root),
    warning: localIntegrityWarning(packageName, version, options.offline === true),
  };
}
