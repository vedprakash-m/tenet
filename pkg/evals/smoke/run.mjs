import { execFile } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
function option(name) {
  const index = args.indexOf(name);
  if (index < 0) throw new Error(`missing ${name}`);
  return args[index + 1];
}

const cli = path.resolve(option("--cli"));
const out = path.resolve(option("--out"));
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scratch = "Q:\\Ved\\Pers\\backtest-clones\\smoke-matrix";
const repos = JSON.parse(await readFile(path.join(__dirname, "repos.json"), "utf8"));

function run(command, commandArgs, cwd, timeoutMs = 120000) {
  const start = process.hrtime.bigint();
  return new Promise((resolve) => {
    const child = execFile(
      command,
      commandArgs,
      { cwd, encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 * 1024, timeout: timeoutMs },
      (error, stdout, stderr) => {
        let elapsed = Number(process.hrtime.bigint() - start) / 1e9;
        const timedOut = error?.killed === true && /timed? out|SIGTERM/i.test(error?.message || "");
        resolve({
          exit: typeof error?.code === "number" ? error.code : (error ? 1 : 0),
          elapsed,
          timedOut,
          stdout: stdout || "",
          stderr: stderr || "",
        });
      },
    );
  });
}

function text(result) {
  return [result.stdout.trimEnd(), result.stderr.trimEnd()].filter(Boolean).join("\n").trim();
}

function firstLines(value) {
  return value.split(/\r?\n/).slice(0, 40).join("\n");
}

function classify(result) {
  if (result.elapsed > 60 || result.timedOut) return "slow";
  const value = text(result);
  let envelope = null;
  try {
    envelope = JSON.parse(value);
  } catch {}
  const codes = envelope?.errors?.map((error) => error.code).filter(Boolean) || [];
  if (/UnhandledPromiseRejection|TypeError|ReferenceError|SyntaxError|Traceback|^\s*at\s/m.test(value)) return "crash";
  if (codes.includes("TN-POLICY-MISSING") || /TN-POLICY-MISSING/.test(value)) return "TN-POLICY-MISSING";
  if (codes.includes("TN-INTERNAL") || /TN-INTERNAL/.test(value)) return "TN-INTERNAL";
  if (envelope?.ok === true && result.exit !== 0) return "contradictory";
  if (envelope?.ok === false && result.exit === 0) return "contradictory";
  return "ok";
}

async function prepare(repo) {
  await mkdir(scratch, { recursive: true });
  const dest = path.join(scratch, repo.name);
  await rm(dest, { recursive: true, force: true });

  if (repo.category === "baseline" && repo.repo.includes(":")) {
    await cp(repo.repo, dest, { recursive: true });
    await run("git", ["init"], dest);
    await run("git", ["config", "core.autocrlf", "false"], dest);
    await run("git", ["add", "."], dest);
    await run("git", ["-c", "user.name=Smoke", "-c", "user.email=smoke@example.invalid", "commit", "-m", "Smoke snapshot"], dest);
  } else if (repo.category === "baseline") {
    const source =
      repo.name === "tenet-copilot" ? "Q:\\Ved\\Pers\\backtest-clones\\tenet-copilot" :
      repo.name === "BotFramework-WebChat" ? "Q:\\Ved\\Pers\\backtest-clones\\BotFramework-WebChat" :
      null;
    if (source) await run("git", ["clone", "--no-hardlinks", source, dest], "Q:\\Ved");
  } else {
    await run("git", ["clone", "--no-hardlinks", `https://github.com/${repo.repo}.git`, dest], "Q:\\Ved");
  }
  await run("git", ["config", "core.autocrlf", "false"], dest);
  return dest;
}

const commands = [
  ["onboard", "--inventory-only", "--json"],
  ["check", "--json"],
  ["board", "--json"],
  ["context", "--query", "test", "--budget-tokens", "2000", "--json"],
  ["verify", "--run-checks", "--json"],
];

const summary = ["# Smoke matrix", "", "| Repository | Policy | Command | Exit code | Seconds | Problem |", "|---|---|---|---:|---:|---|"];

await mkdir(out, { recursive: true });

for (const repo of repos) {
  const dest = await prepare(repo);
  const sections = [`# ${repo.name} smoke matrix`, "", `Repository: \`${repo.repo}\``, "", `Category: ${repo.category}`, ""];

  for (const policy of ["without-tenet-yaml", "with-minimal-tenet-yaml"]) {
    const policyFile = path.join(dest, "tenet.yaml");
    if (policy === "without-tenet-yaml") await rm(policyFile, { force: true });
    if (policy === "with-minimal-tenet-yaml") {
      await writeFile(policyFile, 'standard: "~0.1.0-alpha.0"\npaths:\n  records: tenet\nlevel: observe\nspecs:\n  id_prefix: R\n', "utf8");
    }

    sections.push(`## ${policy}`);
    sections.push("");
    for (const commandArgs of commands) {
      const result = await run("node", [cli, ...commandArgs], dest);
      const problem = classify(result);
      const label = commandArgs.join(" ");
      sections.push(`### ${label}`);
      sections.push("");
      sections.push(`- Exit code: ${result.exit}`);
      sections.push(`- Run time: ${result.elapsed.toFixed(3)} seconds`);
      sections.push(`- Problem: ${problem}`);
      sections.push("");
      sections.push("```text");
      sections.push(firstLines(text(result)));
      sections.push("```");
      sections.push("");
      summary.push(`| ${repo.name} | ${policy} | ${label} | ${result.exit} | ${result.elapsed.toFixed(3)} | ${problem} |`);
    }
  }

  await writeFile(path.join(out, `${repo.name}.md`), `${sections.join("\n")}\n`, "utf8");
}

await writeFile(path.join(out, "SUMMARY.md"), `${summary.join("\n")}\n`, "utf8");
