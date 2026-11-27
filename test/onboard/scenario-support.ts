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
    GIT_CONFIG: undefined,
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

function matchesJson(actual: unknown, expected: unknown): boolean {
  try {
    assertJsonMatch(actual, expected);
    return true;
  } catch {
    return false;
  }
}

export function assertJsonMatch(actual: unknown, expected: unknown, location = "$"): void {
  if (expected && typeof expected === "object" && !Array.isArray(expected) && "$assert" in expected) {
    const assertion = expected as Record<string, unknown>;
    const kind = assertion.$assert;
    if (kind === "includes") {
      assert.equal(typeof actual, "string", `${location}: expected string`);
      assert.ok((actual as string).includes(String(assertion.value)), `${location}: expected "${actual}" to include "${assertion.value}"`);
      return;
    }
    if (kind === "size") {
      assert.ok(Array.isArray(actual), `${location}: expected array`);
      assert.equal((actual as unknown[]).length, assertion.value, `${location}: expected array length ${assertion.value}`);
      return;
    }
    if (kind === "maxLength") {
      assert.ok(Array.isArray(actual), `${location}: expected array`);
      assert.ok((actual as unknown[]).length <= Number(assertion.value),
        `${location}: expected length <= ${assertion.value}, got ${(actual as unknown[]).length}`);
      return;
    }
    if (kind === "contains") {
      assert.ok(Array.isArray(actual), `${location}: expected array`);
      const items = actual as unknown[];
      const required = assertion.value as unknown[];
      for (const [index, entry] of required.entries()) {
        assert.ok(items.some((candidate) => matchesJson(candidate, entry)),
          `${location}[${index}]: no array element matched ${JSON.stringify(entry)}`);
      }
      return;
    }
    if (kind === "none") {
      assert.ok(Array.isArray(actual), `${location}: expected array`);
      const items = actual as unknown[];
      assert.ok(!items.some((candidate) => matchesJson(candidate, assertion.value)),
        `${location}: expected no element to match ${JSON.stringify(assertion.value)}`);
      return;
    }
    if (kind === "rankedBefore") {
      assert.ok(Array.isArray(actual), `${location}: expected array`);
      const items = actual as unknown[];
      const firstIndex = items.findIndex((candidate) => matchesJson(candidate, assertion.first));
      assert.ok(firstIndex >= 0, `${location}: expected array to contain ${JSON.stringify(assertion.first)}`);
      for (let index = 0; index <= firstIndex; index += 1) {
        assert.ok(!matchesJson(items[index], assertion.second),
          `${location}[${index}]: expected ${JSON.stringify(assertion.second)} to rank after ${JSON.stringify(assertion.first)}`);
      }
      return;
    }
    if (kind === "or") {
      const options = assertion.options as unknown[];
      assert.ok(options.some((option) => matchesJson(actual, option)),
        `${location}: value ${JSON.stringify(actual)} matched none of ${JSON.stringify(options)}`);
      return;
    }
    if (kind === "all") {
      const checks = assertion.checks as unknown[];
      checks.forEach((check, index) => { assertJsonMatch(actual, check, `${location}.all[${index}]`); });
      return;
    }
  }
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${location}: expected array`);
    assert.equal((actual as unknown[]).length, expected.length, `${location}: array length mismatch`);
    expected.forEach((item, index) => { assertJsonMatch((actual as unknown[])[index], item, `${location}[${index}]`); });
    return;
  }
  if (expected && typeof expected === "object") {
    assert.ok(actual && typeof actual === "object" && !Array.isArray(actual), `${location}: expected object`);
    const record = actual as Record<string, unknown>;
    for (const [key, item] of Object.entries(expected)) {
      assert.ok(Object.hasOwn(record, key), `${location}: missing key ${key}`);
      assertJsonMatch(record[key], item, `${location}.${key}`);
    }
    return;
  }
  assert.deepEqual(actual, expected, location);
}
