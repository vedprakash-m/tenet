// The Host port for the plugin's own binding: the descriptor that ships beside the agents (TS §4.4). Unreadable means unknown.
import { Descriptor, UNKNOWN } from "../core/capabilities.ts";
import type { Host, Recipes } from "../ports/types.ts";

export class PluginHost implements Host {
  private recipes: Recipes;
  private cached: Descriptor | undefined;
  constructor(recipes: Recipes) { this.recipes = recipes; }

  capabilities(): Descriptor {
    if (this.cached) return this.cached;
    let found: unknown = null;
    try { found = JSON.parse(this.recipes.text("com.github.copilot/descriptor.json") ?? "null"); } catch { /* unreadable means unknown */ }
    const parsed = Descriptor.safeParse(found);
    this.cached = parsed.success ? parsed.data : UNKNOWN;
    return this.cached;
  }
}
