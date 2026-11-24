import { createInterface } from "node:readline";
import type { CommandContext, CommandSpec } from "../core/commands.js";
import { message } from "../core/messages.js";
import { errorFinding, fail, version, type Finding } from "../core/output.js";
import { init as runInit } from "../install/init.js";
import { preflight as runPreflight } from "../install/preflight.js";
import type { InitOptions, InitResult, PreflightAnswers, PreflightPrompt, ProjectKind } from "../install/types.js";

type InitDependencies = {
  init?: typeof runInit;
  preflight?: typeof runPreflight;
  terminal?: boolean;
};

function diagnostic(command: string, detail: string): Finding {
  const words = message(`TN-USAGE-${command.toUpperCase()}`, { command, detail });
  return fail(`TN-USAGE-${command.toUpperCase()}`, words.message, words.fix);
}

function handled(error: unknown): Finding {
  const found = errorFinding(error);
  if (found) return found;
  if (error && typeof error === "object" && "finding" in error) {
    const partial = (error as { finding?: { code?: string; file?: string | null } }).finding;
    if (partial?.code) {
      const filename = partial.file ?? (error instanceof Error
        ? error.message.split(": ").at(-1) ?? "."
        : ".");
      try {
        const words = message(partial.code, { path: filename });
        return { ...fail(partial.code, words.message, words.fix), file: partial.file ?? null };
      } catch {
        if (error instanceof Error) {
          return fail(partial.code, error.message, `Review ${filename} and retry.`);
        }
      }
    }
  }
  const detail = error instanceof Error ? error.message : String(error);
  const words = message("TN-INTERNAL", { detail });
  return fail("TN-INTERNAL", words.message, words.fix);
}

function isTty(context: CommandContext, injected: boolean | undefined): boolean {
  return injected ?? ("isTTY" in context.stdin && context.stdin.isTTY === true);
}

function noTty(): Finding {
  const words = message("TN-BLESS-NO-TTY");
  return fail("TN-BLESS-NO-TTY", words.message, words.fix);
}

function answerBoolean(answer: string, fallback: boolean): boolean {
  const normalized = answer.trim().toLowerCase();
  if (normalized === "") return fallback;
  return ["y", "yes"].includes(normalized);
}

function promptLabel(prompt: PreflightPrompt): string {
  if (prompt.key === "reporterEdit") return `${prompt.question} [y/N] `;
  if (prompt.key === "localHosts") return `${prompt.question} [y/N] `;
  return `${prompt.question} `;
}

function preflightText(result: Awaited<ReturnType<typeof runPreflight>>): string {
  const plan = result.plan;
  const facts = result.facts;
  if (!plan) return "";
  const forge = facts.repository.forge === "github"
    ? "GitHub"
    : facts.repository.forge === "other"
      ? "non-GitHub forge"
      : "local repository";
  const host = facts.repository.forge === "github" ? forge : facts.repository.forge;
  const runner = facts.runner ? `${facts.runner.kind} (${facts.runner.command})` : "no test runner";
  const lines = [
    `Found: ${host} · ${runner} · ${plan.hosts.map(({ id, capability }) => `${id} (${capability})`).join(", ")}`,
    `Will create: ${plan.created.join(", ")}`,
    `Will edit: ${[
      ...plan.blocks.map(({ path }) => path),
      ...plan.keys.map(({ path, pointer }) => `${path}${pointer}`),
    ].join(", ")}`,
    ...(plan.local_keys.length > 0 ? [
      `Will edit locally (outside repository): ${plan.local_keys
        .map(({ host, path, pointer }) => `${host}: ${path}${pointer}`)
        .join(", ")}`,
    ] : []),
    `Level: observe (nothing blocks) · CI: ${plan.ci_mode} (${plan.ci_reason})`,
    "Will never read: .env*, credentials, vendor/",
  ];
  return lines.join("\n");
}

function successText(value: InitResult): string {
  if (value.cancelled) return "Cancelled. No files were changed.";
  const count = value.wrote.created.length + value.wrote.blocks.length +
    value.wrote.keys.length + value.wrote.local_keys.length;
  const findings = value.findings.length
    ? `First findings: ${value.findings.map(({ message }) => message).join(" · ")}`
    : "First findings: none";
  return [
    `Set up Tenet${count === 0 ? " (already current)" : ""}.`,
    findings,
    "Next: tenet onboard drafts your specifications.",
  ].join("\n");
}

export function makeInitCommand(dependencies: InitDependencies = {}): CommandSpec {
  const inspect = dependencies.preflight ?? runPreflight;
  const install = dependencies.init ?? runInit;
  return {
    name: "init",
    description: "Install Tenet in the current repository",
    usage: "tenet init [--yes] [--local-hosts] [--vendor] [--force]",
    options: ["--yes", "--local-hosts", "--vendor", "--force"],
    async run(context) {
      if (context.args.length > 0) {
        return {
          findings: [diagnostic("init", `unexpected positional arguments: ${context.args.join(", ")}`)],
        };
      }
      const yes = context.options["--yes"] === true;
      if (!yes && !isTty(context, dependencies.terminal)) {
        return { findings: [noTty()] };
      }

      try {
        const options: InitOptions = {
          cwd: context.cwd,
          yes,
          localHosts: context.options["--local-hosts"] === true,
          offline: context.offline,
          vendor: context.options["--vendor"] === true,
          force: context.options["--force"] === true,
        };
        let prepared = await inspect(options);
        if (prepared.diagnostics.length > 0) return { findings: prepared.diagnostics };
        const answers: PreflightAnswers = {};
        let lines: ReturnType<typeof createInterface> | undefined;
        let next: AsyncIterator<string> | undefined;
        const ask = async (label: string): Promise<string | null> => {
          context.stdout.write(label);
          const answer = await next?.next();
          return answer && !answer.done ? answer.value.trim() : null;
        };
        if (!yes) {
          lines = createInterface({ input: context.stdin, crlfDelay: Infinity, terminal: false });
          next = lines[Symbol.asyncIterator]();
          const reporterPrompt = prepared.prompts.find(({ key }) => key === "reporterEdit");
          if (reporterPrompt) {
            const answer = await ask(promptLabel(reporterPrompt));
            if (answer === null) return { findings: [noTty()] };
            answers.allowReporterEdit = answerBoolean(answer, false);
            prepared = await inspect({ ...options, answers });
            if (prepared.diagnostics.length > 0) return { findings: prepared.diagnostics };
          }
          const localPrompt = prepared.prompts.find(({ key }) => key === "localHosts");
          if (localPrompt) {
            const available = localPrompt.local_keys ?? [];
            if (available.length > 0) {
              context.stdout.write(`Will edit locally (outside repository): ${available
                .map(({ host, path, pointer }) => `${host}: ${path}${pointer}`)
                .join(", ")}\n`);
            }
            const answer = await ask(promptLabel(localPrompt));
            if (answer === null) return { findings: [noTty()] };
            answers.allowLocalHosts = answerBoolean(answer, false);
            prepared = await inspect({ ...options, answers });
            if (prepared.diagnostics.length > 0) return { findings: prepared.diagnostics };
            if (!answers.allowLocalHosts) {
              context.stdout.write(
                `No local host settings changed. To add one manually, install the Tenet MCP entry with command ` +
                `"cmd /c npx -y @vedprakash-m/tenet@${version} mcp".\n`,
              );
            }
          }
          context.stdout.write(`${preflightText(prepared)}\n`);
          for (const prompt of prepared.prompts.filter(({ key }) =>
            key !== "reporterEdit" && key !== "localHosts")) {
            const answer = await ask(promptLabel(prompt));
            if (answer === null) return { findings: [noTty()] };
            if (prompt.key === "purpose") {
              const purpose = answer || (typeof prompt.default === "string" ? prompt.default : "");
              answers.purpose = purpose;
            } else if (prompt.key === "kind") {
              const kind = (answer || prompt.default || "other") as ProjectKind;
              if (!prompt.options?.includes(kind)) {
                return { findings: [diagnostic("init", `invalid project kind: ${kind}`)] };
              }
              answers.kind = kind;
            } else {
              answers.allowReporterEdit = answerBoolean(answer, false);
            }
          }
          const answer = await ask("Continue? [Y/n] ");
          if (answer === null) return { findings: [noTty()] };
          answers.continue = answerBoolean(answer, true);
          lines.close();
          lines = undefined;
        } else {
          context.stdout.write(`${preflightText(prepared)}\n`);
        }

        const value = await install({ ...options, answers });
        for (const finding of value.findings) {
          if (finding.kind === "local-integrity") context.stderr.write(`Warning: ${finding.message}\n`);
        }
        if (!context.json) context.stdout.write(`${successText(value)}\n`);
        return { result: context.json ? value : null, findings: [] };
      } catch (error) {
        return { findings: [handled(error)] };
      }
    },
  };
}

export const initCommand = makeInitCommand();
