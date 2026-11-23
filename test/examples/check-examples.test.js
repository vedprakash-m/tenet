import assert from "node:assert/strict";
import { test } from "node:test";
import {
	commandNames,
	compareKnownFailures,
	inspectExamples,
} from "../../scripts/check-examples.mjs";

const names = new Set(["init", "verify", "task done"]);
const file = "examples.md";
const fence = (language, body) =>
	[`\x60\x60\x60${language}`, body, "\x60\x60\x60"].join("\n");

const samples = [
	["yaml", fence("yaml", "name: build"), fence("yaml", "name: [build")],
	["json", fence("json", '{"name":"build"}'), fence("json", '{"name":}')],
	[
		"schema",
		fence("yaml tenet.yaml", "level: observe"),
		fence("yaml tenet.yaml", "level: strict"),
	],
	[
		"schema",
		fence(
			"yaml",
			"tenet: {spec: 1, doc: intent, level: L1, version: '0.1', owner: ved}\nsections: {requirements: {state: draft, digest: null, flags: []}}",
		),
		fence("yaml", "tenet: {spec: 1}\nsections: {}"),
	],
	[
		"schema",
		fence("json", '{"questions":[]}'),
		fence("json", '{"questions":"none"}'),
	],
	[
		"acceptance",
		fence(
			"markdown",
			"### Acceptance\nImplements: R-12, , C-2\nImplements: R-19\n* [x] [AB-1] first\n- [AB-2] second",
		),
		fence(
			"markdown",
			"## Acceptance\nImplements: R-x\n- [AB-1] first\n- [AB-1] repeat\n- missing ID",
		),
	],
	[
		"tag",
		fence("js", 'it("[AB-1] [R-3] [UTF-8] retries", () => {})'),
		fence("js", 'it("[AB-one] retries", () => {})'),
	],
	[
		"tag",
		fence("python", "def test_retries_tenet_AB_1():"),
		fence("python", "def test_retries_tenet_AB_one():"),
	],
	[
		"tag",
		fence("xml", '<property name="tenet.case" value="AB-1, [R-2] tenet_AB_3">'),
		fence("xml", '<property value="AB-three" name="tenet.case">'),
	],
	[
		"tag",
		fence("json", '{"extra":{"tenet_cases":["AB-1","[R-3]","tenet_AB_2"]}}'),
		fence("json", '{"extra":{"tenet_cases":["AB-x"]}}'),
	],
	[
		"command",
		fence(
			"text",
			"$ tenet init\nnpx -y @vedprakash-m/tenet@<locked version> verify --bundle\n$ tenet task done",
		),
		fence("text", "$ tenet task finish"),
	],
	[
		"card",
		fence(
			"markdown",
			"### Tenet proof · ab1234 · advisory\nYour intent this change touches\nAcceptance\nTests 1 passed",
		),
		fence(
			"markdown",
			"### Tenet proof · ab1234 · advisory\nAcceptance\nYour intent this change touches\nTests 1 passed",
		),
	],
];
for (const [index, [kind, passing, failing]] of samples.entries()) {
	test(`example checker accepts and rejects ${kind} sample ${index + 1}`, () => {
		assert.deepEqual(inspectExamples(file, passing, names).findings, []);
		const { findings } = inspectExamples(file, failing, names);
		assert.ok(findings.length > 0);
		assert.ok(
			findings.every(
				(finding) =>
					finding.kind === kind && finding.file === file && finding.line > 0,
			),
		);
	});
}

test("example checker tracks Markdown fences and ignores nested blocks during acceptance parsing", () => {
	const example = [
		"~~~~md",
		"## Acceptance",
		"- [AB-1] first",
		fence("text", "- ignored"),
		"## Other",
		"- also ignored",
		"~~~~",
	].join("\r\n");
	assert.deepEqual(inspectExamples(file, example, names).findings, []);
	const unclosed = inspectExamples(file, "prose\n~~~yml\nname: build", names);
	assert.equal(unclosed.findings[0].line, 2);
	assert.match(unclosed.findings[0].reason, /Unclosed YAML/);
});

test("example checker takes command names and groups from the contract table and checks inline examples", () => {
	const table =
		"## 8. Commands\n| \x60verify --bundle\x60 | x |\n| \x60task done\x60, \x60init\x60 | x |\n| \x60tenet-runner start\x60, \x60stop\x60 | x |\n## 9. MCP\n| \x60wrong\x60 | no |";
	const actual = commandNames(table);
	assert.deepEqual(actual, names);
	assert.deepEqual(
		inspectExamples(file, "Run \x60tenet task done\x60.", actual).findings,
		[],
	);
	assert.deepEqual(
		inspectExamples(
			file,
			"tenet is a command. Run \x60tenet stop\x60.",
			actual,
		).findings.map(({ reason }) => reason),
		["Unknown Tenet command: stop"],
	);
});

test("example checker uses the configured requirement prefix for test names", () => {
	const example = fence("js", 'test("[UX-bad] [UTF-8] description", () => {})');
	assert.equal(
		inspectExamples(file, example, names, "UX").findings[0].kind,
		"tag",
	);
	assert.deepEqual(inspectExamples(file, example, names, "R").findings, []);
});

test("known example failures match by exact file, line and reason and cannot hide duplicates", () => {
	const known = [
		{
			file,
			line: 2,
			reason: "invalid example",
			proposal: "Correct the example.",
		},
	];
	const [entry] = known;
	assert.deepEqual(compareKnownFailures([entry], known), {
		unexpected: [],
		stale: [],
		matched: 1,
	});
	const replacement = { ...entry, reason: "a different error" };
	assert.deepEqual(compareKnownFailures([replacement], known), {
		unexpected: [replacement],
		stale: known,
		matched: 0,
	});
	assert.deepEqual(compareKnownFailures([], known), {
		unexpected: [],
		stale: known,
		matched: 0,
	});
	assert.deepEqual(compareKnownFailures([entry, entry], known).unexpected, [
		entry,
	]);
	assert.throws(
		() => compareKnownFailures([], [...known, ...known]),
		/duplicate/,
	);
});

test("example checker validates delimiter-wrapped spec front matter", () => {
	const frontMatter =
		"tenet: {spec: 1, doc: intent, level: L1, version: '0.1', owner: ved}\nsections: {requirements: {state: draft, digest: null, flags: []}}";
	assert.deepEqual(
		inspectExamples(
			file,
			fence("markdown", `---\n${frontMatter}\n---\n# Spec`),
			names,
		).findings,
		[],
	);
	const invalid = inspectExamples(
		file,
		fence("markdown", `---\n${frontMatter.replace("draft", "unblessed")}\n---`),
		names,
	);
	assert.equal(invalid.findings[0].kind, "schema");
	assert.equal(invalid.findings[0].line, 2);
});
