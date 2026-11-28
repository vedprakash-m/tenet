import { readFile } from "node:fs/promises";
import path from "node:path";
import { preflight } from "./preflight.js";
import { manifestJson, sha256Bytes } from "./manifest.js";
import { applyPlan, planWriteSet, resumePendingPlan } from "./writes.js";
import type { InitOptions, InitResult, PreflightOptions } from "./types.js";
import type { ReleaseIntegrity } from "./integrity.js";
import { localProfileRoot } from "./environment.js";

async function isComplete(cwd: string, plan: Awaited<ReturnType<typeof planWriteSet>>): Promise<boolean> {
  for (const write of plan.writes) {
    try {
      const filename = write.kind === "local_key"
        ? path.resolve(write.path)
        : path.resolve(cwd, ...write.path.replaceAll("\\", "/").split("/"));
      const bytes = await readFile(filename);
      if (sha256Bytes(bytes) !== write.after_sha256) return false;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }
  try {
    return (await readFile(path.join(cwd, ".tenet", "manifest.json"), "utf8")) === manifestJson(plan.manifest);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function init(options: InitOptions = {}, preparedIntegrity?: ReleaseIntegrity): Promise<InitResult> {
  const preflightOptions: PreflightOptions = { ...options };
  const result = await preflight(preflightOptions);
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const profileRoot = localProfileRoot(options.environment);
  if (options.answers?.continue === false) {
    if (!result.plan) {
      throw Object.assign(new Error(result.diagnostics[0]?.message ?? "Install preflight failed."), {
        finding: result.diagnostics[0],
      });
    }
    return {
      plan: result.plan,
      wrote: { created: [], blocks: [], keys: [], local_keys: [] },
      findings: [],
      cancelled: true,
    };
  }
  const resumed = await resumePendingPlan(cwd, result, {
    ...(options.fault ? { fault: options.fault } : {}),
    ...(profileRoot
      ? { localProfileRoot: profileRoot }
      : {}),
    offline: options.offline === true,
  });
  if (resumed) return { ...resumed, findings: [...result.findings, ...resumed.findings] };
  const plan = await planWriteSet(result, {
    ...options, command: "init", ...(preparedIntegrity ? { preparedIntegrity } : {}),
  });
  const findings = [
    ...result.findings,
    ...(plan.integrity_warning
      ? [{ kind: "local-integrity" as const, path: "tenet.lock", message: plan.integrity_warning }]
      : []),
  ];
  if (await isComplete(cwd, plan)) {
    return {
      plan: plan.plan,
      wrote: { created: [], blocks: [], keys: [], local_keys: [] },
      findings,
    };
  }
  const applied = await applyPlan(plan, {
    ...(options.fault ? { fault: options.fault } : {}),
    ...(profileRoot
      ? { localProfileRoot: profileRoot }
      : {}),
  });
  return { ...applied, findings };
}
