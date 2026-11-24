import { message, onboardText } from "../core/messages.js";
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

export function makeOnboardCommand(deps: OnboardDeps) {
  return {
    name: "onboard",
    description: onboardText.description,
    options: ["--inventory-only", "--refresh", "--layout <layout>", "--card"],
    async handler({ cwd, args, options, json }: OnboardCommandContext) {
      const layout = options["--layout"];
      if (args.length || (layout !== undefined && layout !== "one-file" && layout !== "separate")) {
        const detail = args.length ? onboardText.unexpectedPositionals : onboardText.invalidLayout;
        return { findings: [diagnostic("TN-USAGE-ONBOARD", { command: "onboard", detail })] };
      }
      try {
        if (options["--card"] === true) {
          if (options["--inventory-only"] || options["--refresh"] || layout) {
            return { findings: [diagnostic("TN-USAGE-ONBOARD", { command: "onboard", detail: onboardingCardText.incompatible })] };
          }
          return { value: await onboardingCard({ cwd }) };
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
        if (value.findings.length) output.push(onboardText.firstFindings(value.findings.map(({ message: words }) => words).join(" · ")));
        output.push(onboardText.assignment);
        return { value: output.join("\n"), findings: diagnostics };
      } catch (error) {
        return { findings: [handled(error)] };
      }
    },
  };
}

export const onboardCommand = makeOnboardCommand({ check });
