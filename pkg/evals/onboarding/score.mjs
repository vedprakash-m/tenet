import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { validate } from "../../../dist/core/schema.js";
import { isGovernedSection, measureStatements, parseBlessDocument, statements } from "../../../dist/onboard/bless.js";
import { resolveCitations } from "../../../dist/specs/citations.js";
import { itemLine } from "../../../dist/specs/parse.js";

const hash = (text) => createHash("sha256").update(text).digest("hex");
const normalized = (text) => text.replace(/\{[^{}]*\}/g, "").trim().replace(/\s+/g, " ");
const normalizedAnswer = (text) => normalized(text).replace(/[.!?]$/, "");
const sectionKey = (doc, section) => `${doc}#${section}`;
const canBeBlessing = (key) => key.startsWith("blessed_") || ["recorded", "anchors"].includes(key);

export async function json(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

export function safeReader(cwd) {
  const root = realpathSync(cwd);
  return (file) => {
    if (path.posix.isAbsolute(file) || path.win32.isAbsolute(file) || file.split(/[\\/]/).some((part) => part === ".." || part.toLowerCase() === ".git")) return null;
    try {
      const target = realpathSync(path.join(root, file));
      const rel = path.relative(root, target);
      if (!rel || rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return null;
      return readFileSync(target, "utf8");
    } catch { return null; }
  };
}

export function draftEvidence(drafts, cwd, key, prefix, sources) {
  const read = safeReader(cwd);
  const parsed = drafts.map(({ file, text }) => ({ text, doc: parseBlessDocument(file, text, prefix) }));
  const rows = [];
  const conflicts = [];
  const unauthorized = [];
  const citations = parsed.flatMap(({ doc }) => resolveCitations(doc, (file) => sources.has(path.posix.normalize(file)) ? read(file) : null));
  for (const { text, doc } of parsed) {
    for (const [slug, meta] of Object.entries(doc.front?.sections ?? {})) {
      if (meta?.state === "blessed" || Object.keys(meta ?? {}).some(canBeBlessing)) unauthorized.push(sectionKey(doc.path, slug));
    }
    for (const section of doc.sections) {
      const ref = sectionKey(doc.path, section.slug);
      for (const item of section.conflicts) {
        const source = text.replaceAll("\r\n", "\n").split("\n")[(itemLine(item) ?? 0) - 1] ?? "";
        const options = [...new Set([...source.matchAll(/\|\s*\d+:\s*([^|]+)/g)].map((match) => normalized(match[1])))].filter(Boolean);
        conflicts.push({ id: item.id, ref, source, open: !item.checked && !item.resolution, balanced: options.length >= 2 });
      }
      if (!isGovernedSection(section)) continue;
      const originals = new Map(statements(section).map((item) => [item.id, item]));
      for (const [i, measured] of measureStatements(section).entries()) {
        const source = originals.get(measured.id);
        rows.push({
          ref: `${ref}:${measured.id ?? i + 1}`, text: measured.text,
          origin: measured.origin ?? null, cites: source?.cites ?? [],
        });
      }
    }
  }
  const interviewText = read(".tenet/onboard/interview.json");
  let interview = { questions: [] };
  let interviewValid = interviewText === null;
  if (interviewText !== null) {
    try {
      interview = JSON.parse(interviewText);
      interviewValid = validate("interview", interview).ok && interview.questions.length <= 10 &&
        new Set(interview.questions.map(({ id }) => id)).size === interview.questions.length;
    } catch { interviewValid = false; }
  }
  const supplied = new Map(key.interview_answers.map(({ id, question, answer }) => [id, { question, answer }]));
  const agreed = interviewValid ? interview.questions.filter(({ id, text, answer }) => {
    const expected = supplied.get(id);
    return expected && normalized(text) === normalized(expected.question) && normalized(answer) === normalized(expected.answer);
  }) : [];
  const asked = rows.filter(({ origin }) => origin === "asked");
  const matched = asked.filter((row) => agreed.some(({ answer }) => normalizedAnswer(answer) === normalizedAnswer(row.text)));
  const uncited = rows.filter(({ origin, cites }) => ["observed", "documented"].includes(origin) && !cites.length).map(({ ref }) => ref);
  const claimed = new Map();
  function assign(plant, visited) {
    for (const conflict of conflicts) {
      if (!conflict.open || !conflict.balanced || visited.has(conflict) ||
          !plant.locations.every((file) => conflict.source.includes(file))) continue;
      visited.add(conflict);
      const previous = claimed.get(conflict);
      if (!previous || assign(previous, visited)) {
        claimed.set(conflict, plant);
        return true;
      }
    }
    return false;
  }
  for (const plant of key.planted_conflicts) assign(plant, new Set());
  const reported = new Map([...claimed].map(([conflict, plant]) => [plant.kind, conflict.id]));
  return {
    rows, citations, uncited, unauthorized, interviewValid, asked: asked.length, grounded: matched.length,
    ungrounded: asked.filter((row) => !matched.includes(row)).map(({ ref }) => ref),
    settledConflicts: conflicts.filter(({ open }) => !open).map(({ id }) => id),
    planted: key.planted_conflicts.map(({ kind }) => ({ kind, reported: reported.get(kind) ?? null })),
    obligations: key.obligations.map(({ id, text }) => ({
      id, exact: rows.find((row) => normalizedAnswer(row.text) === normalizedAnswer(text))?.ref ?? null,
    })),
  };
}

export async function blessingMeasures(cwd, records = "tenet") {
  const file = path.join(cwd, records, "blessed/log.jsonl");
  const text = await readFile(file, "utf8").catch((error) => {
    if (error.code !== "ENOENT") throw error;
    return "";
  });
  const rows = text.split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line));
  const scored = new Map();
  const sessions = new Map();
  let inferredSession = 0;
  let lastStart;
  for (const row of rows) {
    const ref = sectionKey(row.doc, row.section);
    if (["bless", "reject"].includes(row.action) && !scored.has(ref)) scored.set(ref, row);
    const millis = Date.parse(row.at);
    if (!Number.isFinite(millis) || typeof row.minutes !== "number" || row.minutes < 0) continue;
    const start = millis - row.minutes * 60_000;
    if (lastStart === undefined || Math.abs(start - lastStart) >= 1000) inferredSession++;
    lastStart = start;
    const id = row.session_id ? `id:${row.session_id}` : `start:${inferredSession}`;
    sessions.set(id, Math.max(row.minutes, sessions.get(id) ?? 0));
  }
  const measures = [...scored.values()];
  const available = measures.length > 0 && measures.every(({ statements: s }) =>
    Number.isSafeInteger(s?.drafted) && Number.isSafeInteger(s?.kept) && s.kept >= 0 && s.kept <= s.drafted);
  const drafted = available ? measures.reduce((sum, row) => sum + row.statements.drafted, 0) : null;
  const kept = available ? measures.reduce((sum, row) => sum + (row.action === "reject" ? 0 : row.statements.kept), 0) : null;
  return {
    drafted, kept, ratio: drafted > 0 ? kept / drafted : null,
    deferred: new Set(rows.filter(({ action }) => action === "defer").map(({ doc, section }) => sectionKey(doc, section))).size,
    minutes: sessions.size ? [...sessions.values()].reduce((sum, minutes) => sum + minutes, 0) : null,
  };
}

function cleanCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\r?\n/g, " ");
}
const cell = (...fields) => `| ${fields.map(cleanCell).join(" | ")} |`;
const statistic = (x) => x === null ? "unavailable" : `${(x * 100).toFixed(1)}%`;

export function scoreReport({ agent, model, effort, date, harness, cases }) {
  const rank = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const auditFixture = cases.filter(({ evidence }) => evidence).sort((a, b) => rank(hash(`${a.name}:${a.revision}`), hash(`${b.name}:${b.revision}`)))[0]?.name;
  const text = [
    "# Tenet onboarding evaluation", "",
    `Agent ${agent} · model ${model} · effort ${effort} · UTC date ${date} · harness ${harness}`, "",
    "Automatic checks cover citations, open conflicts with distinct options and source locations, exact interview grounding, and unauthorized blessing. Exact obligation matches are review leads. Independent people score semantic recall and invention. Kept ratio and blessing time come from the Owner's action log.", "",
    "| Fixture | Revision | Check exit | Citation failures | Conflicts | Asked grounded | Unauthorized blessings | Kept | Minutes | Human recall | Human inventions |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|",
  ];
  for (const entry of cases) {
    const { name, revision, evidence: e, measures: m } = entry;
    text.push(entry.error ? cell(name, revision, "failed", "", "", "", "", "", "", "", "") :
      cell(name, revision, entry.checkExit, e.citationFailures, `${e.planted.filter(({ reported }) => reported).length}/${e.planted.length}`,
        `${e.grounded}/${e.asked}`, e.unauthorized.length, statistic(m.ratio), m.minutes ?? "unavailable", "", ""));
  }
  text.push("", `Second scorer reviews the marked \u226520% per fixture and all obligations in ${auditFixture ?? "no fixture"}.`,
    "", "| Scoring check | Raw agreement | Cohen's kappa | Adjudication |", "|---|---|---|---|",
    cell("Recall matching", "", "", ""), cell("Invented classification", "", "", ""));
  for (const entry of cases) {
    text.push("", `## ${entry.name}`, "");
    if (entry.error) { text.push(`Execution failure. ${entry.error}`); continue; }
    const e = entry.evidence;
    const m = entry.measures;
    text.push(`Setup ${entry.setup}. Draft revision ${entry.draftRevision}. Scored log counts ${m.kept ?? "unavailable"}/${m.drafted ?? "unavailable"}. Deferred sections ${m.deferred}.`, "");
    if (!e.rows.length) text.push("The draft contains no scorable statements.", "");
    if (!entry.stampMatches) text.push("The card did not pin every draft to the recorded draft revision.", "");
    if (entry.checkCodes.length) text.push(`Check findings ${entry.checkCodes.join(", ")}.`, "");
    if (e.uncited.length) text.push(`Uncited observed/documented statements ${e.uncited.join(", ")}.`, "");
    if (e.ungrounded.length || !e.interviewValid) text.push(`Interview grounding needs review ${e.ungrounded.join(", ") || "invalid interview record"}.`, "");
    if (e.unauthorized.length || e.settledConflicts.length) text.push(`Unexpected blessing or conflict resolution ${[...e.unauthorized, ...e.settledConflicts].join(", ")}.`, "");
    text.push("| Planted conflict | Open CF match |", "|---|---|", ...e.planted.map(({ kind, reported }) => cell(kind, reported ?? "missing")), "",
      "| Obligation | Exact text lead | Second scorer sample | Primary recall | Second recall |", "|---|---|---|---|---|",
      ...e.obligations.map(({ id, exact }) => cell(id, exact, entry.name === auditFixture ? "sample" : "", "", "")), "",
      "| Draft statement | Origin | Text | Second scorer sample | Primary invention | Second invention |",
      "|---|---|---|---|---|---|");
    const sorted = [...e.rows].sort((a, b) => rank(hash(`${entry.revision}:${a.ref}`), hash(`${entry.revision}:${b.ref}`)));
    const sample = new Set(sorted.slice(0, Math.ceil(sorted.length / 5)).map(({ ref }) => ref));
    text.push(...e.rows.map(({ ref, origin, text: statement }) => cell(ref, origin, statement, sample.has(ref) ? "sample" : "", "", "")));
  }
  return `${text.join("\n")}\n`;
}
