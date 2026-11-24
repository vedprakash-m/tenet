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
    const names = ["vision.md", "prd.md", "tech-spec.md", "ux-spec.md", "plan.md"];
    const docName = index <= names.length ? names[index - 1] : `spec-${String(index).padStart(2, "0")}.md`;
    const docPath = index === 1 ? "vision.md" : docName.startsWith("spec-") ? `specs/${docName}` : `specs/${docName}`;
    const level = index === 1 ? "L0" : index === 2 ? "L1" : "L2";
    const doc = index === 1 ? "vision" : index === 2 ? "prd" : index === 3 ? "tech-spec" : index === 4 ? "ux-spec" : index === 5 ? "plan" : "design";
    const slug = index === 1 ? "purpose" : index === 2 ? "requirements" : index === 3 ? "design" : index === 4 ? "experience" : index === 5 ? "plan" : `design-${index}`;
    const digest = randomHex(`section-${index}`, 64);
    const owner = "bench";
    const heading = index === 1 ? "Purpose" : index === 2 ? "Requirements" : index === 3 ? "Design" : index === 4 ? "Experience" : index === 5 ? "Plan" : `Design ${index}`;
    const body = index === 1
      ? `- V-${index} Fixed benchmark vision ${randomHex(`vision-${index}`, 32)}. {origin: asked}`
      : index === 2
        ? `- R-${index} Fixed benchmark requirement ${randomHex(`requirement-${index}`, 32)}. {origin: asked}`
        : `Fixed benchmark content ${randomHex(`requirement-${index}`, 32)}.`;
    const text = [
      "---",
      `tenet: {spec: 1, doc: ${doc}, level: ${level}, version: "0.1", owner: ${owner}}`,
      "sections:",
      `  ${slug}: {state: draft, digest: sha256:${digest}, blessed_digest: null, blessed_at_rev: null, anchors: {}, flags: []}`,
      "---",
      `## ${heading}`,
      body,
      "",
    ].join("\n");
    await writeFile(path.join(out, "tenet", docPath), text, "utf8");
    documents.push(`    - {path: ${docPath}, level: ${level}}`);
  }

  const yaml = [
    'standard: "~0.1.0-alpha.0"',
    "kit_path: kit",
    "paths:",
    "  records: tenet",
    "level: observe",
    "specs:",
    "  id_prefix: R",
    "  documents:",
    ...documents,
  ].join("\n") + "\n";
  await writeFile(path.join(out, "tenet.yaml"), yaml, "utf8");
  await mkdir(path.join(out, "kit"), { recursive: true });
  await writeFile(path.join(out, "kit", "TENET.md"), "# Benchmark kit\n", "utf8");
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
