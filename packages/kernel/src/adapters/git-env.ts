// Git's repository-local variables, as `git rev-parse --local-env-vars` lists them. Inherited from the caller, they point
// Git at another repository, object store, index or configuration, so the kernel and its tools never pass them on.
const LOCAL = new Set([
  "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_CONFIG", "GIT_CONFIG_PARAMETERS", "GIT_CONFIG_COUNT", "GIT_OBJECT_DIRECTORY",
  "GIT_DIR", "GIT_WORK_TREE", "GIT_IMPLICIT_WORK_TREE", "GIT_GRAFT_FILE", "GIT_INDEX_FILE", "GIT_NO_REPLACE_OBJECTS",
  "GIT_REPLACE_REF_BASE", "GIT_PREFIX", "GIT_SHALLOW_FILE", "GIT_COMMON_DIR",
]);

/** Names compare without case, because Windows environment names are case-insensitive. */
export const isGitLocalVar = (name: string): boolean => LOCAL.has(name.toUpperCase());

/** A copy of `env` without Git's repository-local variables. */
export function withoutGitLocalVars<T extends string | undefined>(env: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(env).filter(([k]) => !isGitLocalVar(k)));
}

/** Removes Git's repository-local variables from `env` in place; the process entry calls this on `process.env`. */
export function dropGitLocalVars(env: Record<string, string | undefined>): void {
  for (const k of Object.keys(env)) if (isGitLocalVar(k)) delete env[k];
}
