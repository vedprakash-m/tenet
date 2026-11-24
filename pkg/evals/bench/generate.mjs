import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function exec(command, args, cwd) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd, encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(Object.assign(error, { stderr }));
      else resolve(stdout);
    });
  });
}

function randomHex(seed, length) {
  let value = "";
  let counter = 0;
  while (Buffer.byteLength(value, "utf8") < length) {
    const digest = createHash("sha256").update(`${seed}:${counter++}`).digest("hex");
    value += digest;
  }
  return value.slice(0, length);
}

async function main() {
  const out = path.resolve(option("--out", "bench"));
  const docs = Number(option("--docs", "1000"));
  const size = Number(option("--size", "1024"));
  const specs = Number(option("--specs", "5"));
  if (!Number.isInteger(docs) || docs < 0) throw new Error("--docs must be a non-negative integer");
  if (!Number.isInteger(size) || size < 128) throw new Error("--size must be an integer of at least 128");
  if (!Number.isInteger(specs) || specs < 1) throw new Error("--specs must be a positive integer");

  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });

  for (let index = 0; index < docs; index += 1) {
    const a = String(index % 100).padStart(2, "0");
    const b = String(Math.floor(index / 100) % 100).padStart(2, "0");
    const c = String(index).padStart(6, "0");
    const dir = path.join(out, "content", a, b);
    await mkdir(dir, { recursive: true });
    const body = `# Benchmark document ${c}\n\n${randomHex(`bench-${index}`, size)}\n`;
    await writeFile(path.join(dir, `page-${c}.md`), body.slice(0, size), "utf8");
  }

  const documents = [];
  await mkdir(path.join(out, "tenet", "specs"), { recursive: true });
  for (let index = 1; index <= specs; index += 1) {
    const docName = index === 1 ? "prd.md" : `spec-${String(index).padStart(2, "0")}.md`;
    const docPath = `specs/${docName}`;
    const level = index === 1 ? "L1" : "L2";
    const slug = index === 1 ? "requirements" : `design-${index}`;
    const text = [
      "---",
      `tenet: {"spec":1,"doc":"bench-${index}","level":"${level}","version":"0.1","owner":"bench"}`,
      "sections:",
      `  ${slug}: {"state":"draft","digest":"sha256:${randomHex(`section-${index}`, 64)}","flags":[]}`,
      "---",
      `## ${index === 1 ? "Requirements" : `Design ${index}`}`,
      `- R-${index} Fixed benchmark requirement ${randomHex(`requirement-${index}`, 32)}.`,
      "",
    ].join("\n");
    await writeFile(path.join(out, "tenet", docPath), text, "utf8");
    documents.push(`    - {path: ${docPath}, level: ${level}}`);
  }

  const yaml = [
    'standard: "~0.1.0-alpha.0"',
    "paths:",
    "  records: tenet",
    "level: observe",
    "specs:",
    "  id_prefix: R",
    "  documents:",
    ...documents,
  ].join("\n") + "\n";
  await writeFile(path.join(out, "tenet.yaml"), yaml, "utf8");
  await mkdir(path.join(out, "src"), { recursive: true });
  await writeFile(path.join(out, "src", "bench.ts"), "export const bench = true;\n", "utf8");

  await exec("git", ["init"], out);
  await exec("git", ["config", "core.autocrlf", "false"], out);
  await exec("git", ["config", "user.name", "Bench"], out);
  await exec("git", ["config", "user.email", "bench@example.invalid"], out);
  await exec("git", ["add", "."], out);
  await exec("git", ["commit", "-m", "Benchmark fixture"], out);
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
