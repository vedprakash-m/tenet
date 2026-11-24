import { execFile } from "node:child_process";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scratch = "Q:\\Ved\\Pers\\backtest-clones\\smoke";
const cli = "Q:\\Ved\\Pers\\tenet\\dist\\cli.js";

function run(command, args, cwd) {
  const start = process.hrtime.bigint();
  return new Promise((resolve) => {
    execFile(command, args, { cwd, encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      const elapsed = Number(process.hrtime.bigint() - start) / 1e9;
      resolve({ exit: error?.code === 0 ? 0 : (typeof error?.code === "number" ? error.code : 1), elapsed, stdout: stdout || "", stderr: stderr || "" });
    });
  });
}

function outputText(result) {
  return [result.stdout.trimEnd(), result.stderr.trimEnd()].filter(Boolean).join("\n").trim();
}

function firstLines(text) {
  return text.split(/\r?\n/).slice(0, 40).join("\n");
}

function problem(text, exit) {
  if (/TN-ENV-NOT-GIT/.test(text)) return "crash or stack trace";
  if (/TN-INTERNAL/i.test(text) && /tenet\.yaml.*(?:not found|was not found|required)|(?:not found|no).*tenet\.yaml/i.test(text)) return "TN-INTERNAL; tenet.yaml required";
  if (/TN-INTERNAL|stack trace|Traceback|\n\s*at\s.+|UnhandledPromiseRejection|TypeError|ReferenceError|SyntaxError/i.test(text)) return "crash or stack trace";
  if (/tenet\.yaml.*(?:not found|was not found|required)|(?:not found|no).*tenet\.yaml/i.test(text)) return "tenet.yaml required";
  if (/"ok"\s*:\s*true/.test(text) && exit !== 0) return "contradictory output";
  if (/"ok"\s*:\s*false/.test(text) && exit === 0) return "contradictory output";
  if (!text && exit !== 0) return "no output";
  return "ok";
}

async function main() {
  await mkdir(scratch, { recursive: true });
  const repos = [
    { name: "tenet-copilot", source: "Q:\\Ved\\Pers\\backtest-clones\\tenet-copilot" },
    { name: "BotFramework-WebChat", source: "Q:\\Ved\\Pers\\backtest-clones\\BotFramework-WebChat" },
    { name: "torus", source: "Q:\\Ved\\Pers\\torus" },
  ];
  const commands = [
    ["onboard", "--inventory-only", "--json"],
    ["check", "--json"],
    ["board", "--json"],
    ["context", "--query", "test", "--budget-tokens", "2000", "--json"],
    ["verify", "--run-checks", "--json"],
  ];

  const summary = ["# Smoke summary", "", "| Repository | Command | Exit code | Seconds | Problem |", "|---|---|---:|---:|---|"];

  for (const repo of repos) {
    const dest = path.join(scratch, repo.name);
    await rm(dest, { recursive: true, force: true });
    if (repo.name === "torus") {
      await cp(repo.source, dest, { recursive: true });
      await run("git", ["init"], dest);
      await run("git", ["config", "core.autocrlf", "false"], dest);
      await run("git", ["add", "."], dest);
      await run("git", ["-c", "user.name=Smoke", "-c", "user.email=smoke@example.invalid", "commit", "-m", "Smoke snapshot"], dest);
    } else {
      await run("git", ["clone", "--no-hardlinks", repo.source, dest], "Q:\\Ved");
    }

    const sections = [`# ${repo.name} smoke`, ""];
    for (const args of commands) {
      const result = await run("node", [cli, ...args], dest);
      const text = outputText(result);
      const label = args.join(" ");
      const issue = problem(text, result.exit);
      sections.push(`## ${label}`);
      sections.push("");
      sections.push(`- Exit code: ${result.exit}`);
      sections.push(`- Run time: ${result.elapsed.toFixed(3)} seconds`);
      sections.push(`- Problem: ${issue}`);
      sections.push("");
      sections.push("```text");
      sections.push(firstLines(text));
      sections.push("```");
      sections.push("");
      summary.push(`| ${repo.name} | ${label} | ${result.exit} | ${result.elapsed.toFixed(3)} | ${issue} |`);
    }
    await writeFile(path.join(__dirname, `${repo.name}.md`), `${sections.join("\n")}\n`, "utf8");
  }

  await writeFile(path.join(__dirname, "SUMMARY.md"), `${summary.join("\n")}\n`, "utf8");
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
