import { lstatSync } from "node:fs";
import { KernelError } from "../core/errors.ts";
import { DirectoryIdentity, sameDirectoryIdentity } from "../core/marker-identity.ts";

export interface IdentityQualification {
  platform: "darwin" | "linux" | "win32";
  architecture: "arm64" | "x64";
  filesystem: string;
  birthTimeSource: "native-birthtime-ns";
}

export interface DirectoryObservation {
  directory: boolean;
  symbolicLink: boolean;
  dev: bigint;
  ino: bigint;
  birthNs: bigint;
}

const unavailable = (detail: string): never => {
  throw new KernelError(
    "marker-identity-unavailable",
    `${detail}; Tenet did not create or change local state`,
    { exit: 3 },
  );
};

function observeDirectory(path: string): DirectoryObservation {
  try {
    const stat = lstatSync(path, { bigint: true });
    return {
      directory: stat.isDirectory(),
      symbolicLink: stat.isSymbolicLink(),
      dev: stat.dev,
      ino: stat.ino,
      birthNs: stat.birthtimeNs,
    };
  } catch {
    return unavailable("the directory identity cannot be read safely");
  }
}

function admitObservation(
  qualification: IdentityQualification,
  observation: DirectoryObservation,
): DirectoryIdentity {
  if (qualification.birthTimeSource !== "native-birthtime-ns") {
    unavailable("the creation-time source is not a qualified native birth time");
  }
  if (!observation.directory || observation.symbolicLink) {
    unavailable("the marker root is not a real directory");
  }
  if (observation.dev <= 0n || observation.ino <= 0n || observation.birthNs <= 0n) {
    unavailable("the native directory identity contains a zero value");
  }
  const parsed = DirectoryIdentity.safeParse({
    kind: "directory-v1",
    platform: qualification.platform,
    architecture: qualification.architecture,
    filesystem: qualification.filesystem,
    dev: String(observation.dev),
    ino: String(observation.ino),
    birthNs: String(observation.birthNs),
  });
  if (!parsed.success) return unavailable("the native directory identity is outside the admitted decimal bounds");
  return parsed.data;
}

export function readQualifiedDirectoryIdentity(
  path: string,
  qualification: IdentityQualification,
  observe: (path: string) => DirectoryObservation = observeDirectory,
): DirectoryIdentity {
  const first = admitObservation(qualification, observe(path));
  const second = admitObservation(qualification, observe(path));
  if (!sameDirectoryIdentity(first, second)) {
    unavailable("the directory identity changed between the capture and recheck");
  }
  return first;
}
