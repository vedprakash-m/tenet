import { commandHelp } from "../core/cli-help.js";
import type { CommandSpec } from "../core/commands.js";
import { message } from "../core/messages.js";
import { errorFinding, fail } from "../core/output.js";
import { doctorEvaluation } from "../install/doctor.js";

type DoctorDependencies = { doctor?: typeof doctorEvaluation };

export function makeDoctorCommand(dependencies: DoctorDependencies = {}): CommandSpec {
  const evaluate = dependencies.doctor ?? doctorEvaluation;
  return {
    ...commandHelp.doctor,
    async run(context) {
      if (context.args.length > 0) {
        const words = message("TN-USAGE-DOCTOR", {
          command: "doctor",
          detail: `unexpected positional arguments: ${context.args.join(", ")}`,
        });
        return { findings: [fail("TN-USAGE-DOCTOR", words.message, words.fix)] };
      }
      try {
        const evaluation = await evaluate({ cwd: context.cwd });
        if (!context.json) {
          context.stdout.write(`${evaluation.checks
            .map((check) => `${check.ok ? "✓" : "×"} ${check.name}: ${check.detail}`)
            .join("\n")}\n`);
        }
        for (const notice of evaluation.notices ?? []) {
          context.stderr.write(`Warning: ${notice}\n`);
        }
        return {
          result: context.json ? { checks: evaluation.checks } : null,
          findings: evaluation.findings,
          exitCode: evaluation.exitCode,
        };
      } catch (error) {
        const found = errorFinding(error);
        if (found) return { findings: [found] };
        const detail = error instanceof Error ? error.message : String(error);
        const words = message("TN-INTERNAL", { detail });
        return { findings: [fail("TN-INTERNAL", words.message, words.fix)] };
      }
    },
  };
}

export const doctorCommand = makeDoctorCommand();
