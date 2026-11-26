import { access, constants } from "node:fs/promises";
import path from "node:path";
import type { HostContext, HostDescriptor, HostWritePlan, SelectableHost } from "./types.js";

const skillNames = ["draft-specs", "review-with-findings", "work-a-change"] as const;

function emptyPlan(): HostWritePlan {
  return { created: [], blocks: [], keys: [], local_keys: [] };
}

function skillWrites(prefix: string): string[] {
  return skillNames.map((name) => `${prefix}/tenet-${name}/SKILL.md`);
}

function localKey(
  context: HostContext,
  host: string,
  relativePath: string,
  pointer: string,
): HostWritePlan["local_keys"] {
  const root = context.localProfileRoots?.[host] ?? context.localProfileRoot;
  if (!root && context.platform !== "win32") return [];
  if (!root) return [];
  if (!context.windowsCommandShimRequired?.includes(host)) return [];
  const filename = path.join(root, ...relativePath.split("/")).replaceAll("\\", "/");
  return [{ host, path: filename, pointer }];
}

async function exists(context: HostContext, relative: string): Promise<boolean> {
  try {
    await access(path.join(context.cwd, ...relative.replaceAll("\\", "/").split("/")), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export const hostDescriptors: HostDescriptor[] = [
  {
    id: "claude",
    capabilityLevel: "skills+mcp",
    async detect(context) {
      return (await exists(context, ".claude")) || exists(context, "CLAUDE.md");
    },
    planWrites(context) {
      return {
        created: skillWrites(".claude/skills"),
        blocks: [{ path: "CLAUDE.md", kind: "markdown" }],
        keys: [{ path: ".mcp.json", pointer: "/mcpServers/tenet" }],
        local_keys: localKey(context, "claude", ".claude.json", "/mcpServers/tenet"),
      };
    },
  },
  {
    id: "cursor",
    capabilityLevel: "mcp",
    detect: (context) => exists(context, ".cursor"),
    planWrites(context) {
      const plan = emptyPlan();
      plan.keys.push({ path: ".cursor/mcp.json", pointer: "/mcpServers/tenet" });
      plan.local_keys.push(...localKey(context, "cursor", "Cursor/User/mcp.json", "/mcpServers/tenet"));
      return plan;
    },
  },
  {
    id: "copilot",
    capabilityLevel: "instructions",
    detect: (context) => exists(context, ".github/copilot-instructions.md"),
    planWrites() {
      return {
        ...emptyPlan(),
        blocks: [{ path: ".github/copilot-instructions.md", kind: "markdown" }],
      };
    },
  },
  {
    id: "vscode",
    capabilityLevel: "mcp",
    detect: (context) => exists(context, ".vscode"),
    planWrites(context) {
      const plan = emptyPlan();
      plan.keys.push({ path: ".vscode/mcp.json", pointer: "/servers/tenet" });
      plan.local_keys.push(...localKey(context, "vscode", "Code/User/mcp.json", "/servers/tenet"));
      return plan;
    },
  },
  {
    id: "agents",
    capabilityLevel: "skills+mcp",
    detect: () => true,
    planWrites() {
      return {
        created: skillWrites(".agents/skills"),
        blocks: [{ path: "AGENTS.md", kind: "markdown" }],
        keys: [],
        local_keys: [],
      };
    },
  },
];

export const HOST_DESCRIPTORS = hostDescriptors;

export async function detectHosts(
  context: HostContext,
  requested: SelectableHost[] = [],
): Promise<HostDescriptor[]> {
  const detected: HostDescriptor[] = [];
  const selected = new Set(requested);
  for (const descriptor of hostDescriptors) {
    if (selected.has(descriptor.id as SelectableHost) || await descriptor.detect(context)) {
      detected.push(descriptor);
    }
  }
  return detected.sort((left, right) => compareUtf16(left.id, right.id));
}

export function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
