// Shared inputs for the migration file-protocol tests and their kill fixture. The registry and binding below are test values, not
// product policy:
// the registry content and the configuration projection are open questions in the report (Q2, Q3).
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hashOf } from "../../src/core/ids.ts";
import { registryVersionOf } from "../../src/core/traits.ts";
import type { UpcastContext } from "../../src/core/schemas-upcast.ts";
import { state1 } from "./schema1-fixtures.ts";

export const ctx: UpcastContext = { registryVersion: registryVersionOf({ traits: ["fixture"] }),
  bindingHash: (w) => hashOf({ fixtureBinding: w.id }) };
export const builds = { bridge: "bridge-1", target: "target-2", design: "design-1" };
export const OPERATION = "1".repeat(32);
export const ROLLBACK = "2".repeat(32);

export const SEED = {
  marker: JSON.stringify({ workspaceId: "ws_aaaaaaaaaa", tag: "abcd", nonce: "nnnnnnnnnnnn", schema: 1, dev: 1, ino: 2 }),
  state: JSON.stringify(state1(9)), prev: JSON.stringify(state1(8)),
  log: `${JSON.stringify({ t: "2026-11-03T00:00:00.000Z", kind: "call", verb: "open", exit: 0, revision: 9 })}\n`,
};

export function markerText(dir: string, schema = 1): string {
  const { dev, ino } = statSync(dir);
  return JSON.stringify({ workspaceId: "ws_aaaaaaaaaa", tag: "abcd", nonce: "nnnnnnnnnnnn", schema, dev, ino });
}

/** A `.tenet` directory holding schema-1 files; the previous state and the summaries are optional. */
export function seed(dir: string, o: { previous?: boolean; summaries?: string } = {}): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "marker"), markerText(dir));
  writeFileSync(join(dir, "state"), SEED.state);
  if (o.previous !== false) writeFileSync(join(dir, "state.prev"), SEED.prev);
  writeFileSync(join(dir, "log"), SEED.log);
  if (o.summaries) writeFileSync(join(dir, "summaries.json"), o.summaries);
}

/** Every file under the directory (relative path to its text), so a test can prove nothing else changed. */
export function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string, rel: string) => readdirSync(d).sort().forEach((n) => {
    const p = join(d, n), r = rel ? `${rel}/${n}` : n;
    if (statSync(p).isDirectory()) walk(p, r); else out[r] = readFileSync(p, "utf8");
  });
  walk(dir, "");
  return out;
}
