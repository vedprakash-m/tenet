import { message, onboardText } from "../core/messages.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fail, type Finding } from "../core/output.js";
import { onboardingCard, onboardingCardText } from "../onboard/card.js";
import { prepareOnboard } from "../onboard/assignment.js";
import type { OnboardDeps } from "../onboard/refresh.js";
import { check } from "../specs/check.js";

type OnboardCommandContext = {
  args: string[];
  options: Record<string, string | boolean | string[]>;
  cwd: string;
  json: boolean;
};

function diagnostic(code: string, vars: Record<string, string> = {}): Finding {
  const words = message(code, vars);
  return fail(code, words.message, words.fix);
}

function handled(error: unknown): Finding {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    if ("severity" in error && error.severity === "error") return error as Finding;
    if (error.code === "TN-PATH-ESCAPE") {
      const filename = error instanceof Error ? error.message.split(": ").at(-1) ?? "." : ".";
      return diagnostic(error.code, { path: filename });
    }
  }
  return diagnostic("TN-INTERNAL", { detail: error instanceof Error ? error.message : String(error) });
}

function archiveHint(value: Awaited<ReturnType<typeof prepareOnboard>>["value"]): string | null {
  const counts = new Map<string, number>();
  for (const file of value.inventory.sources.files) {
    const parts = file.path.split("/");
    for (let index = 0; index < parts.length - 1; index += 1) {
      const folder = parts[index]?.toLowerCase();
      if (folder === "archive" || folder === ".archive" || folder === "old") {
        counts.set(folder, (counts.get(folder) ?? 0) + 1);
      }
    }
  }
  const entry = [...counts.entries()].sort((left, right) => left[0].localeCompare(right[0])).find(([, count]) => count > 10);
  return entry ? `Hint: ${entry[1]} inventoried files are under ${entry[0]}/. Review onboard.exclude if this folder should be skipped.` : null;
}

async function draftingPrompt(cwd: string): Promise<string> {
  const packageRoot = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
  const shippedSkill = path.join(packageRoot, "kit", "skills", "draft-specs", "SKILL.md");
  try {
    const text = await readFile(shippedSkill, "utf8");
    const name = /^name:\s*(.+)$/m.exec(text)?.[1]?.trim();
    if (name) return `Next: Use the \`${name}\` skill to draft this project's specifications from \`.tenet/onboard/assignment.json\`.`;
  } catch {
    // The installed skill path is used when the package metadata cannot be read.
  }
  return "Next: Use the skill at `.agents/skills/tenet-draft-specs/SKILL.md` to draft this project's specifications from `.tenet/onboard/assignment.json`.";
}

export function makeOnboardCommand(deps: OnboardDeps) {
  return {
    name: "onboard",
    description: onboardText.description,
    options: ["--inventory-only", "--refresh", "--layout <layout>", "--card", "--pr <number>"],
    async handler({ cwd, args, options, json }: OnboardCommandContext) {
      const layout = options["--layout"];
      const prOption = options["--pr"];
      if (prOption !== undefined && (options["--card"] !== true || typeof prOption !== "string" || !/^\d+$/.test(prOption))) {
        return { findings: [diagnostic("TN-USAGE-ONBOARD", { command: "onboard", detail: "--pr needs a pull request number and --card" })] };
      }
      const pr = typeof prOption === "string" ? Number(prOption) : undefined;
      if (args.length || (layout !== undefined && layout !== "one-file" && layout !== "separate")) {
        const detail = args.length ? onboardText.unexpectedPositionals : onboardText.invalidLayout;
        return { findings: [diagnostic("TN-USAGE-ONBOARD", { command: "onboard", detail })] };
      }
      try {
        if (options["--card"] === true) {
          if (options["--inventory-only"] || options["--refresh"] || layout) {
            return { findings: [diagnostic("TN-USAGE-ONBOARD", { command: "onboard", detail: onboardingCardText.incompatible })] };
          }
          const cardOptions = { cwd, ...(pr === undefined ? {} : { pr }) };
          return { value: json ? await onboardingCard({ ...cardOptions, format: "result" }) : await onboardingCard(cardOptions) };
        }
        const { value, diagnostics } = await prepareOnboard({
          cwd,
          inventoryOnly: options["--inventory-only"] === true,
          refresh: options["--refresh"] === true,
          ...(layout ? { layout } : {}),
        }, deps);
        if (json) return { value, findings: diagnostics };

        const preflight = value.preflight;
        const output = [
          onboardText.read, onboardText.skip, onboardText.drafting,
          onboardText.readCounts(preflight.revision, preflight.read_count, preflight.skipped_count),
        ];
        if (preflight.dirty_warning) output.push(message("TN-SUBJ-DIRTY", { command: "onboard" }).message);
        if (value.inventory.sources.skipped.length) {
          const reasons = new Map<string, string[]>();
          for (const skipped of value.inventory.sources.skipped) {
            const paths = reasons.get(skipped.reason) ?? [];
            paths.push(skipped.path);
            reasons.set(skipped.reason, paths);
          }
          const skipped = [...reasons.entries()].map(([reason, files]) => {
            const names = reason === "excluded" ? ` (${files.join(", ")})` : "";
            return `${reason} ${files.length}${names}`;
          }).join(" · ");
          output.push(`Skipped files: ${skipped}`);
        }
        if (value.findings.length) {
          const counts = new Map<string, number>();
          for (const finding of value.findings) counts.set(finding.kind, (counts.get(finding.kind) ?? 0) + 1);
          const kinds = [...counts.entries()].map(([kind, count]) => `${kind} ${count}`).join(" · ");
          output.push(`First findings: ${value.findings.length} total (${kinds})`);
          for (const finding of value.findings.slice(0, 5)) output.push(`- ${finding.message}`);
          if (value.findings.length > 5) output.push(`- ${value.findings.length - 5} more findings; see .tenet/onboard/inventory.json`);
        } else {
          output.push("First findings: none");
        }
        const hint = archiveHint(value);
        if (hint) output.push(hint);
        output.push(onboardText.assignment);
        output.push(await draftingPrompt(cwd));
        return { value: output.join("\n"), findings: diagnostics };
      } catch (error) {
        return { findings: [handled(error)] };
      }
    },
  };
}

export const onboardCommand = makeOnboardCommand({ check });
