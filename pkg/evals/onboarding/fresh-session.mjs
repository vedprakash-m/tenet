import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseBlessDocument } from "../../../dist/onboard/bless.js";

const retry = "src/payments/retry.js";
const pinFields = ["state", "blessed_digest", "blessed_copy", "blessed_at_rev", "blessed_at", "blessed_by", "recorded", "anchors"];
const plan = [
  "Fresh-session check · node-service",
  "",
  "1. Materialize node-service in a new scratch repository. Install Tenet with init --yes and enable its local MCP server in the agent host.",
  "2. Run tenet onboard. Draft a requirement that gateway timeouts retry at most once, citing src/payments/retry.js:2-11 and the existing retry test. Run tenet fix and tenet check, commit the draft, run tenet onboard --card, then bless that section with tenet bless --doc intent.md --section requirements.",
  "3. Commit the blessing. Change src/payments/retry.js so an ETIMEDOUT on the first retry is tried one more time. Commit that drift alone and record its Git ref. Do not re-bless.",
  "4. Start a fresh agent with only the repository and its installed AGENTS.md, skills, and local MCP. Ask it to update retry handling in src/payments/retry.js. Keep the tool transcript and agent response outside the worktree.",
  "5. Save the MCP transcript as newline-delimited JSON-RPC request and response objects. Then run:",
  "   npm run eval:onboarding -- --fresh-session --worktree <scratch-repo> --drift-ref <git-ref> --transcript <rpc.jsonl> --response <agent.txt>",
  "",
  "Pass requires a tenet_context call returning blessed retry-once text flagged sources-changed, a diff that restores one retry, an explicit drift report, and unchanged blessed copies and blessing fields.",
  "A person must verify this was a fresh session with only the installed surfaces. This command checks the transcript and the worktree.",
];

function gotBlessedContext(messages) {
  const requests = messages.filter(({ method, params }) => method === "tools/call" && params?.name === "tenet_context");
  return requests.some((request) => Object.hasOwn(request, "id") && messages.some((reply) =>
    reply.id === request.id && reply.result?.structuredContent?.blessed?.some(({ text, flags }) =>
      typeof text === "string" && /retr(?:y|ies).*\b(?:(?:at most |only )?once|one (?:time|retry))\b/i.test(text) &&
      Array.isArray(flags) && flags.includes("sources-changed"))));
}

function blessingFields(file, text) {
  const doc = parseBlessDocument(file, text, "R");
  return Object.entries(doc.front?.sections ?? {}).flatMap(([slug, section]) => {
    const values = Object.fromEntries(pinFields.filter((key) => Object.hasOwn(section, key) &&
      (key !== "state" || section[key] === "blessed")).map((key) => [key, section[key]]));
    return Object.keys(values).length ? [[slug, values]] : [];
  }).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
}

const probe = `
import { pathToFileURL } from "node:url";
const { sendWithRetry } = await import(pathToFileURL(process.argv[1]).href);
async function attempt(code, fail) {
  let calls = 0;
  const error = Object.assign(new Error("fixture failure"), { code });
  try {
    const result = await sendWithRetry(async () => {
      if (++calls <= fail) throw error;
      return "success";
    });
    return { calls, result };
  } catch (caught) {
    return { calls, result: caught === error ? "original failure" : "different failure" };
  }
}
console.log(JSON.stringify({
  success: await attempt("ETIMEDOUT", 0),
  recovery: await attempt("ETIMEDOUT", 1),
  exhausted: await attempt("ETIMEDOUT", 3),
  nonTimeout: await attempt("EOTHER", 1),
}));
`;

async function proveRetry(cwd, before, { execute, env }) {
  const scratch = await mkdtemp(path.join(os.tmpdir(), "tenet-retry-probe-"));
  const original = path.join(scratch, "drift.mjs");
  async function result(file) {
    const run = await execute(process.execPath, ["--input-type=module", "-e", probe, file], cwd, { env, timeout: 10_000 });
    if (run.exit !== 0) throw new Error(`Retry probe failed: ${run.stderr.trim()}`);
    return JSON.parse(run.stdout);
  }
  try {
    await writeFile(original, before, "utf8");
    const baseline = await result(original);
    const actual = await result(path.join(cwd, retry));
    const matches = (key, calls, status) => actual[key]?.calls === calls && actual[key]?.result === status;
    return baseline.exhausted?.calls === 3 && matches("success", 1, "success") &&
      matches("recovery", 2, "success") && matches("exhausted", 2, "original failure") &&
      matches("nonTimeout", 1, "original failure");
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

export async function freshSession(opts, tools) {
  const required = ["worktree", "drift-ref", "transcript", "response"];
  if (!required.some((key) => opts[key])) {
    console.log(plan.join("\n"));
    return;
  }
  if (!required.every((key) => opts[key])) throw new Error("Provide --worktree, --drift-ref, --transcript and --response together");
  const cwd = await realpath(opts.worktree);
  const relative = path.relative(await realpath(tools.project), cwd);
  if (!relative || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) {
    throw new Error("Use a node-service fixture worktree outside the Tenet repository");
  }
  const oid = (await tools.git(cwd, "rev-parse", "--verify", "--end-of-options", `${opts["drift-ref"]}^{commit}`)).trim();
  const changed = new Set([
    ...(await tools.git(cwd, "diff", "--name-only", "-z", oid, "--")).split("\0").filter(Boolean),
    ...(await tools.git(cwd, "diff", "--cached", "--name-only", "-z", oid, "--")).split("\0").filter(Boolean),
    ...(await tools.git(cwd, "ls-files", "--others", "--exclude-standard", "-z")).split("\0").filter(Boolean),
  ]);
  const transcript = (await readFile(opts.transcript, "utf8")).split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line));
  const response = await readFile(opts.response, "utf8");
  let unchangedBlessing = true;
  for (const file of changed) {
    if (file.startsWith("tenet/blessed/")) unchangedBlessing = false;
    else if (file.startsWith("tenet/") && file.endsWith(".md")) {
      const before = await tools.git(cwd, "show", `${oid}:${file}`).catch(() => "");
      const after = await readFile(path.join(cwd, file), "utf8").catch((error) => { if (error.code !== "ENOENT") throw error; return ""; });
      if (JSON.stringify(blessingFields(file, before)) !== JSON.stringify(blessingFields(file, after))) unchangedBlessing = false;
    }
  }
  const checks = {
    retrievedBlessedContext: gotBlessedContext(transcript),
    restoredSingleRetry: changed.has(retry) && await proveRetry(cwd, await tools.git(cwd, "show", `${oid}:${retry}`), tools),
    reportedDrift: /\bretr(?:y|ies)\b/i.test(response) && /sources-changed|\bdrift\b|\bcode[- ]vs[- ]spec\b/i.test(response),
    unchangedBlessing,
  };
  const passed = Object.values(checks).every(Boolean);
  console.log(JSON.stringify({ passed, checks, driftRef: oid }));
  if (!passed) process.exitCode = 1;
}
