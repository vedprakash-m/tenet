import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

export function canonicalCoverage(contents, root = process.cwd()) {
  const records = [];
  for (const chunk of contents.replaceAll("\r\n", "\n").split("end_of_record")) {
    const lines = chunk.trim().split("\n").filter(Boolean);
    const sourceLine = lines.find((line) => line.startsWith("SF:"));
    if (!sourceLine) continue;
    const source = portableSource(sourceLine.slice(3), root);
    if (!source.startsWith("src/")) continue;
    records.push({
      source,
      text: canonicalRecord(source, lines, branchSlots(source, root)),
    });
  }
  records.sort((left, right) => byteCompare(left.source, right.source));
  if (records.length === 0) throw new Error("coverage report contains no src/ records");
  return `TN:\n${records.map(({ text }) => text).join("\n")}\n`;
}

function canonicalRecord(source, lines, sourceBranches) {
  const data = {
    branches: [],
    da: new Map(),
    functions: [],
    functionHits: new Map(),
  };
  for (const line of lines) {
    const da = /^DA:(\d+),(-?\d+)/.exec(line);
    if (da) {
      const number = Number(da[1]);
      data.da.set(number, (data.da.get(number) ?? false) || Number(da[2]) > 0);
      continue;
    }
    const fn = /^FN:(\d+),(.*)$/.exec(line);
    if (fn) {
      data.functions.push({ line: Number(fn[1]), name: fn[2] });
      continue;
    }
    const fnda = /^FNDA:(-?\d+),(.*)$/.exec(line);
    if (fnda) {
      data.functionHits.set(
        fnda[2],
        (data.functionHits.get(fnda[2]) ?? 0) + Number(fnda[1]),
      );
      continue;
    }
    const branch = /^BRDA:(\d+),[^,]*,[^,]*,([^,]*)$/.exec(line);
    if (branch) {
      data.branches.push({
        covered: branch[2] !== "-" && Number(branch[2]) > 0,
        line: Number(branch[1]),
      });
    }
  }

  const linesOut = sortedEntries(data.da).map(
    ([line, covered]) => `DA:${line},${covered ? 1 : 0}`,
  );
  const functions = normalizeFunctions(data.functions, data.functionHits);
  const functionLines = functions.map(
    ({ covered, name }) => `FNDA:${covered ? 1 : 0},${name}`,
  );
  const functionDefinitions = functions.map(({ line, name }) => `FN:${line},${name}`);
  const branchEntries = stableBranches(data.branches, sourceBranches);
  const branches = branchEntries.map(
    ({ covered, line }, index) => `BRDA:${line},0,${index},${covered ? 1 : 0}`,
  );
  return [
    `SF:${source}`,
    ...functionDefinitions,
    ...functionLines,
    `FNF:${functions.length}`,
    `FNH:${functions.filter(({ covered }) => covered).length}`,
    ...branches,
    `BRF:${branches.length}`,
    `BRH:${branches.filter((entry) => entry.endsWith(",1")).length}`,
    ...linesOut,
    `LH:${linesOut.filter((entry) => entry.endsWith(",1")).length}`,
    `LF:${linesOut.length}`,
    "end_of_record",
  ].join("\n");
}

function stableBranches(observed, expected) {
  const byLine = new Map();
  for (const entry of observed) {
    const values = byLine.get(entry.line) ?? [];
    values.push(entry.covered);
    byLine.set(entry.line, values);
  }
  const lines = new Set([...byLine.keys(), ...expected.keys()]);
  const stable = [];
  for (const line of [...lines].sort((left, right) => left - right)) {
    const covered = (byLine.get(line) ?? []).sort(
      (left, right) => Number(left) - Number(right),
    );
    const count = expected.get(line) ?? covered.length;
    if (covered.length > count) covered.splice(0, covered.length - count);
    while (covered.length < count) covered.unshift(false);
    for (let index = 0; index < count; index += 1) {
      stable.push({ covered: covered[index] ?? false, line });
    }
  }
  return stable;
}

function branchSlots(source, root) {
  const filename = path.join(root, ...source.split("/"));
  let text;
  try {
    text = readFileSync(filename, "utf8");
  } catch {
    return new Map();
  }
  const file = ts.createSourceFile(
    source,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const slots = new Map();
  function visit(node) {
    if (isBranch(node)) {
      const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
      slots.set(line, (slots.get(line) ?? 0) + 1);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return slots;
}

function isBranch(node) {
  if (ts.isIfStatement(node) ||
      ts.isConditionalExpression(node) ||
      ts.isForStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node) ||
      ts.isCaseClause(node) ||
      ts.isCatchClause(node)) {
    return true;
  }
  return ts.isBinaryExpression(node) &&
    [
      ts.SyntaxKind.AmpersandAmpersandToken,
      ts.SyntaxKind.BarBarToken,
      ts.SyntaxKind.QuestionQuestionToken,
      ts.SyntaxKind.AmpersandAmpersandEqualsToken,
      ts.SyntaxKind.BarBarEqualsToken,
      ts.SyntaxKind.QuestionQuestionEqualsToken,
    ].includes(node.operatorToken.kind);
}

function normalizeFunctions(functions, hits) {
  const sorted = functions
    .map((item) => ({ ...item, covered: (hits.get(item.name) ?? 0) > 0 }))
    .sort((left, right) =>
      left.line - right.line ||
      Number(left.covered) - Number(right.covered) ||
      byteCompare(left.name, right.name)
    );
  const anonymous = new Map();
  return sorted.map((item) => {
    if (!/^anonymous_\d+$/.test(item.name)) return item;
    const key = item.line;
    const index = anonymous.get(key) ?? 0;
    anonymous.set(key, index + 1);
    return { ...item, name: `anonymous@${key}:${index}` };
  });
}

function sortedEntries(map) {
  return [...map].sort(([left], [right]) => left - right);
}

function portableSource(filename, root) {
  const absolute = path.isAbsolute(filename) ? filename : path.resolve(root, filename);
  const relative = path.relative(root, absolute);
  const shown = relative.startsWith("..") ? filename : relative;
  return shown.replaceAll("\\", "/");
}

function byteCompare(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}
