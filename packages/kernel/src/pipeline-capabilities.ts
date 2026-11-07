import { hashOf } from "./core/ids.ts";
import type { State } from "./core/schemas.ts";
import type { Ports } from "./ports/types.ts";
import { settingsFor } from "./verbs/reconcile.ts";

export function prepareCapabilities(ports: Ports, state: State | null): void {
  if (!ports.host.prepare) return;
  const policyHash = hashOf({
    file: ports.project.hashes(["tenet.policy.json"])["tenet.policy.json"],
    settings: settingsFor(ports, state),
  });
  ports.host.prepare({
    pluginVersion: ports.version, policyHash, at: ports.clock.now(),
    read: path => ports.project.readBounded(path, 20 * 1024 * 1024),
  }, state?.capabilityCache);
}

export function capabilitiesState(ports: Ports, state: State | undefined, verb: string, current: State | null): State | undefined {
  if (verb === "stop") return state;
  state ??= current ?? undefined;
  if (!state) return undefined;
  const cache = ports.host.cache?.();
  return cache && hashOf(cache) !== hashOf(state.capabilityCache ?? {})
    ? { ...state, capabilityCache: cache } : state;
}

export function capabilityIdentity(ports: Ports, world: unknown): unknown {
  const cache = ports.host.cache?.();
  const keys = cache && Object.fromEntries(Object.entries(cache).map(([name, entry]) => [name, entry.provenance.key]));
  return cache ? { world, capabilities: keys } : world;
}
