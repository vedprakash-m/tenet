// The Host port for the plugin's own binding: the descriptor that ships beside the agents (TS §4.4). Unreadable means unknown.
import { capabilityKey, Descriptor, UNKNOWN } from "../core/capabilities.ts";
import type { CapabilityCache } from "../core/capabilities.ts";
import { hashOf } from "../core/ids.ts";
import type { CapabilityContext, Host, Recipes } from "../ports/types.ts";

export class PluginHost implements Host {
  private recipes: Recipes;
  private cached: Descriptor | undefined;
  private records: CapabilityCache = {};
  private hostVersion: string | null;
  constructor(recipes: Recipes, hostVersion?: string) {
    this.recipes = recipes;
    this.hostVersion = hostVersion && /^[a-zA-Z0-9._+ -]{1,120}$/.test(hostVersion) ? hostVersion : null;
  }

  prepare(context: CapabilityContext, previous: CapabilityCache = {}): void {
    const descriptor = this.declaration();
    const caps = { ...UNKNOWN };
    const records: CapabilityCache = {};
    const identity = { hostVersion: this.hostVersion, pluginVersion: context.pluginVersion, policyHash: context.policyHash };
    for (const name of Descriptor.keyof().options) {
      const cap = descriptor[name];
      const inputs: Record<string, string | null> = {};
      let unavailable = cap.dependencies ? undefined : "dependency declaration unavailable";
      for (const path of cap.dependencies ?? []) {
        const input = context.read(path);
        if (input.status === "available") inputs[path] = input.sha256;
        else if (input.cause === "missing") inputs[path] = null;
        else unavailable = `declared input ${input.cause}`;
      }
      const inputsHash = hashOf({ declaration: cap, inputs });
      const key = capabilityKey(identity, inputsHash);
      const old = previous[name];
      const reused = !unavailable && this.hostVersion !== null && old?.provenance.key === key &&
        capabilityKey(old.provenance, old.provenance.inputsHash) === key;
      const observation = unavailable ? { value: "unknown", source: "unknown" as const, evidence: unavailable } : cap;
      const provenance = reused ? old.provenance : { ...identity, inputsHash, key, probedAt: context.at };
      caps[name] = { ...(reused ? old.observation : observation), provenance: { ...provenance, reused: !!reused } };
      if (!unavailable) records[name] = { observation: reused ? old.observation : observation, provenance };
    }
    this.cached = caps;
    this.records = records;
  }

  cache(): CapabilityCache { return this.records; }

  private declaration(): Descriptor {
    let found: unknown = null;
    try { found = JSON.parse(this.recipes.text("com.github.copilot/descriptor.json") ?? "null"); }
    catch { /* invalid means unknown below */ }
    const parsed = Descriptor.safeParse(found);
    if (parsed.success && Object.values(parsed.data).every(cap => cap.provenance === undefined)) return parsed.data;
    const unknown = { ...UNKNOWN };
    for (const name of Descriptor.keyof().options)
      unknown[name] = { ...UNKNOWN[name], evidence: "missing or invalid capability descriptor" };
    return unknown;
  }

  capabilities(): Descriptor { return this.cached ?? this.declaration(); }
}
