import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";

// Scenario callbacks run serially in their own node:test process. The in-process CLI
// starts Git with process.env, so scope the environment to the entire scenario.
export async function isolateScenarioGit(scratch: string): Promise<() => void> {
  const config = path.join(scratch, "gitconfig");
  await writeFile(config, "[user]\n\tname = Scenario Owner\n\temail = scenario@example.invalid\n");
  const overrides = {
    GIT_CONFIG_GLOBAL: config,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_COUNT: undefined,
    GIT_CONFIG_PARAMETERS: undefined,
  };
  const previous = Object.entries(overrides).map(([key]) => [key, process.env[key]] as const);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return () => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

export function assertGolden(actual: unknown, expected: unknown, countUse: () => void): void {
  function bind(value: unknown, observed: unknown, location: string): unknown {
    // Exact scalar tokens are for host-dependent tool versions and build-dependent lock digests.
    const token = typeof value === "string" ? /^\{\{any:([^{}]*)\}\}$/.exec(value) : null;
    if (token && token[0] === value) {
      const type = token[1];
      assert.ok(type === "string" || type === "number", `Unsupported golden placeholder at ${location}: ${value}`);
      countUse();
      assert.ok(typeof observed === type && (type !== "number" || Number.isFinite(observed)),
        `Expected an existing JSON ${type} at ${location}, got ${observed === null ? "null" : typeof observed}`);
      return observed;
    }
    function child(key: string) {
      return observed && typeof observed === "object" && Object.hasOwn(observed, key)
        ? (observed as Record<string, unknown>)[key] : undefined;
    }
    if (Array.isArray(value)) return value.map((item, index) => bind(item, child(String(index)), `${location}[${index}]`));
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, bind(item, child(key), `${location}.${key}`)]));
    }
    return value;
  }
  assert.deepEqual(actual, bind(expected, actual, "$"));
}
