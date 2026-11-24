import path from "node:path";
import type { PreflightEnvironment } from "./types.js";

export function localProfileRoot(
  environment: PreflightEnvironment = {},
): string | undefined {
  if (environment.localProfileRoot !== undefined) {
    return environment.localProfileRoot;
  }
  const platform = environment.platform ?? process.platform;
  if (platform !== "win32") return undefined;
  const appData = process.env.LOCALAPPDATA;
  if (appData) return path.resolve(appData);
  const profile = process.env.USERPROFILE;
  if (profile) return path.resolve(profile, "AppData", "Roaming");
  const home = process.env.HOME;
  return home ? path.resolve(home, "AppData", "Roaming") : undefined;
}

export function localProfileRoots(
  environment: PreflightEnvironment = {},
): Partial<Record<string, string>> | undefined {
  if (environment.localProfileRoot !== undefined) {
    return {
      claude: environment.localProfileRoot,
      cursor: environment.localProfileRoot,
      vscode: environment.localProfileRoot,
    };
  }
  if ((environment.platform ?? process.platform) !== "win32") return undefined;
  const home = process.env.USERPROFILE ?? process.env.HOME;
  const roaming = process.env.APPDATA ??
    (process.env.USERPROFILE ? path.resolve(process.env.USERPROFILE, "AppData", "Roaming") : undefined) ??
    (process.env.HOME ? path.resolve(process.env.HOME, "AppData", "Roaming") : undefined);
  if (!home && !roaming) return undefined;
  return {
    ...(home ? { claude: path.resolve(home) } : {}),
    ...(roaming ? { cursor: path.resolve(roaming), vscode: path.resolve(roaming) } : {}),
  };
}

export function windowsCommandShimRequired(
  environment: PreflightEnvironment,
  detectedMcpHosts: string[],
): string[] | undefined {
  if (environment.windowsCommandShimRequired !== undefined) {
    return environment.windowsCommandShimRequired;
  }
  return (environment.platform ?? process.platform) === "win32"
    ? detectedMcpHosts
    : undefined;
}
