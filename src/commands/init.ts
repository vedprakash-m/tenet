import { commandHelp } from "../core/cli-help.js";
import { createInterface } from "node:readline";
import { existsSync } from "node:fs";
import path from "node:path";
import type { CommandContext, CommandSpec } from "../core/commands.js";
import { message } from "../core/messages.js";
import { errorFinding, fail, version, type Finding } from "../core/output.js";
import { init as runInit } from "../install/init.js";
import { preflight as runPreflight, preflightInitIntegrity } from "../install/preflight.js";
import { releaseIntegrity } from "../install/integrity.js";
import type {
  InitOptions,
  InitResult,
  PreflightAnswers,
  PreflightPrompt,
  ProjectKind,
  SelectableHost,
} from "../install/types.js";

type InitDependencies = {
  init?: typeof runInit;
  preflight?: typeof runPreflight;
  integrity?: typeof preflightInitIntegrity;
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
  const words = message("TN-INIT-NO-TTY");
  return fail("TN-INIT-NO-TTY", words.message, words.fix);
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

function pathPurpose(itemPath: string, pointer?: string): string {
  if (itemPath === "tenet.yaml") return "project policy and checks";
  if (itemPath === "tenet.lock") return "pinned Tenet version and kit integrity";
  if (itemPath === ".tenet/manifest.json") return "record of managed setup";
  if (itemPath === ".tenet/manifest.local.json") return "record of managed local host settings";
  if (itemPath === "tenet/intent.md") return "starter specification draft";
  if (itemPath === "AGENTS.md") return "Tenet workflow and review rules for agents";
  if (itemPath === "CLAUDE.md") return "points Claude Code to AGENTS.md";
  if (itemPath === ".github/copilot-instructions.md") return "points GitHub Copilot to AGENTS.md";
  if (itemPath === ".gitignore") return "ignores Tenet's local generated state";
  if (itemPath === ".gitattributes") return "keeps Tenet-managed text files stable";
  if (itemPath.toLowerCase() === ".github/pull_request_template.md") {
    return "adds the Tenet acceptance template";
  }
  if (itemPath === ".github/workflows/tenet.yml") return "records Tenet proof from the default branch";
  if (itemPath === ".github/workflows/tenet-tests.yml") return "runs the configured tests for Tenet";
  if (itemPath.startsWith(".github/workflows/")) return "adds the Tenet step to the existing test workflow";
  if (itemPath.startsWith(".claude/skills/")) return "Claude Code skill";
  if (itemPath.startsWith(".agents/skills/")) return "portable agent skill";
  if (itemPath.startsWith(".tenet/kit/")) return "vendors the pinned Tenet kit";
  if (itemPath === ".mcp.json" || itemPath.endsWith("/mcp.json")) {
    return `registers the Tenet MCP server${pointer ? ` at ${pointer}` : ""}`;
  }
  return "Tenet-managed setup file";
}

function planRows(
  paths: Array<{ path: string; pointer?: string }>,
): string[] {
  const unique = new Map(paths.map((item) => {
    const displayed = `${item.path}${item.pointer ?? ""}`;
    return [displayed, `- ${displayed} — ${pathPurpose(item.path, item.pointer)}`];
  }));
  return [...unique.values()];
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
  const create: Array<{ path: string }> = [];
  const edit: Array<{ path: string; pointer?: string }> = [];
  const plannedPaths = [
    ...plan.created.map((itemPath) => ({ path: itemPath })),
    ...plan.blocks.map((block) => ({ path: block.path })),
    ...plan.keys,
  ];
  for (const item of plannedPaths) {
    if (existsSync(path.resolve(result.facts.repository.cwd, item.path))) edit.push(item);
    else create.push(item);
  }
  const createRows = planRows(create);
  const editRows = planRows(edit);
  const lines = [
    `Found: ${host} · ${runner} · ${plan.hosts.map(({ id, capability }) => `${id} (${capability})`).join(", ")}`,
    ...(plan.hosts.every(({ id }) => id === "agents")
      ? ["No agent host found; skills are in .agents/skills/. Rerun with `--host claude` to set up Claude Code."]
      : []),
    "Will create:",
    ...(createRows.length > 0 ? createRows : ["- none"]),
    "Will edit:",
    ...(editRows.length > 0 ? editRows : ["- none"]),
    ...(plan.local_keys.length > 0 ? [
      "Will edit locally (outside repository):",
      ...plan.local_keys.map(({ host, path: itemPath, pointer }) =>
        `- ${host}: ${itemPath}${pointer} — registers the Tenet MCP server locally for ${host}`),
    ] : []),
    `Level: observe (nothing blocks) · CI: ${plan.ci_mode} (${plan.ci_reason})`,
    "Will never read: .env*, credentials, vendor/",
  ];
  return lines.join("\n");
}

function successText(value: InitResult, offline: boolean, hasTestCheck: boolean): string {
  if (value.cancelled) return "Cancelled. No files were changed.";
  const count = value.wrote.created.length + value.wrote.blocks.length +
    value.wrote.keys.length + value.wrote.local_keys.length;
  const findings = value.findings.length
    ? `First findings: ${value.findings.map(({ message }) => message).join(" · ")}`
    : "First findings: none";
  if (offline && value.findings.some(({ kind }) => kind === "local-integrity")) {
    const otherFindings = value.findings.filter(({ kind }) => kind !== "local-integrity");
    return [
      `Set up Tenet${count === 0 ? " (already current)" : ""}.`,
      "Recorded local package integrity (offline). Run `tenet upgrade` once you're online so CI can verify it.",
      ...(otherFindings.length > 0
        ? [`First findings: ${otherFindings.map(({ message }) => message).join(" · ")}`]
        : []),
      ...(!hasTestCheck ? ["No test check configured. Add checks.test in tenet.yaml (see docs/getting-started.md#configure-your-tests)."] : []),
      "Next: tenet onboard drafts your specifications.",
    ].join("\n");
  }
  return [
    `Set up Tenet${count === 0 ? " (already current)" : ""}.`,
    findings,
    ...(!hasTestCheck ? ["No test check configured. Add checks.test in tenet.yaml (see docs/getting-started.md#configure-your-tests)."] : []),
    "Next: tenet onboard drafts your specifications.",
  ].join("\n");
}

export function makeInitCommand(dependencies: InitDependencies = {}): CommandSpec {
  const inspect = dependencies.preflight ?? runPreflight;
  const install = dependencies.init ?? runInit;
  const inspectIntegrity = dependencies.integrity ?? preflightInitIntegrity;
  return {
    ...commandHelp.init,
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

      let lines: ReturnType<typeof createInterface> | undefined;
      try {
        const rawHosts = context.options["--host"];
        const selectedHosts = rawHosts === undefined
          ? []
          : (Array.isArray(rawHosts) ? rawHosts : [rawHosts]);
        const allowedHosts: SelectableHost[] = ["claude", "cursor", "copilot", "vscode"];
        const invalidHost = selectedHosts.find((host) =>
          typeof host !== "string" || !allowedHosts.includes(host as SelectableHost)
        );
        if (invalidHost !== undefined) {
          return {
            findings: [diagnostic(
              "init",
              `unknown host: ${String(invalidHost)} (choose claude, cursor, copilot or vscode)`,
            )],
          };
        }
        const hosts = [...new Set(selectedHosts as SelectableHost[])];
        const options: InitOptions = {
          cwd: context.cwd,
          yes,
          ...(hosts.length > 0 ? { hosts } : {}),
          localHosts: context.options["--local-hosts"] === true,
          offline: context.offline,
          vendor: context.options["--vendor"] === true,
          force: context.options["--force"] === true,
        };
        let prepared = await inspect(options);
        if (prepared.diagnostics.length > 0) return { findings: prepared.diagnostics };
        const answers: PreflightAnswers = {};
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
          const testCommandPrompt = prepared.prompts.find(({ key }) => key === "testCommand");
          if (testCommandPrompt) {
            const answer = await ask(promptLabel(testCommandPrompt));
            if (answer === null) return { findings: [noTty()] };
            answers.testCommand = answer;
            prepared = await inspect({ ...options, answers });
            if (prepared.diagnostics.length > 0) return { findings: prepared.diagnostics };
          }
          context.stdout.write(`${preflightText(prepared)}\n`);
          for (const prompt of prepared.prompts.filter(({ key }) =>
            key !== "reporterEdit" && key !== "localHosts" && key !== "testCommand")) {
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
        } else {
          context.stdout.write(preflightText(prepared) + "\n");
        }

        // A scripted resume already has the confirmed integrity in its saved plan.
        const resuming = yes && existsSync(path.join(context.cwd, ".tenet", "manifest.pending.json"));
        const integrity = resuming ? undefined : await inspectIntegrity(options);
        if (integrity?.customRegistry) {
          context.stdout.write("Tenet checks the public npm registry for the published package integrity that CI verifies.\n");
        }
        let release = integrity?.release;
        let offline = options.offline === true;
        if (integrity?.finding) {
          const { detail, ...finding } = integrity.finding;
          if (yes) return { findings: [context.verbose ? integrity.finding : finding] };
          context.stdout.write(finding.message + "\n");
          if (context.verbose && detail) context.stdout.write("detail: " + detail + "\n");
          const fallback = await ask("Record local package integrity instead (same as `--offline`)? [y/N] ");
          if (fallback === null) return { findings: [noTty()] };
          if (!answerBoolean(fallback, false)) answers.continue = false;
          else {
            offline = true;
            release = await releaseIntegrity({ ...options, offline });
          }
        }
        if (!yes && answers.continue !== false) {
          const answer = await ask("Continue? [Y/n] ");
          if (answer === null) return { findings: [noTty()] };
          answers.continue = answerBoolean(answer, true);
        }
        lines?.close();

        const value = await install({ ...options, offline, answers }, release);
        if (!offline) {
          for (const finding of value.findings) {
            if (finding.kind === "local-integrity") context.stderr.write(`Warning: ${finding.message}\n`);
          }
        }
        if (!context.json) {
          context.stdout.write(`${successText(value, offline, prepared.facts.runner !== null)}\n`);
        }
        return { result: context.json ? value : null, findings: [] };
      } catch (error) {
        return { findings: [handled(error)] };
      } finally {
        lines?.close();
      }
    },
  };
}

export const initCommand = makeInitCommand();
