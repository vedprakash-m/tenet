import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test, type TestContext } from "node:test";
import { board, renderSpecsBoard } from "../../dist/views/specs-board.js";
import { tmpRepo } from "../helpers/tmpRepo.ts";

type Fixture = {
	operation: "board";
	options: { all?: boolean };
	repo: {
		repository: string;
		now: string;
		read: { main: string | null; branches: string[]; records: string | null };
		files: Record<string, string>;
	};
	markdownMode: "fragments" | "ux-example";
};

function project(actual: unknown, expected: unknown): unknown {
	if (
		expected &&
		typeof expected === "object" &&
		!Array.isArray(expected) &&
		"$assert" in expected &&
		(expected as Record<string, unknown>).$assert === "contains"
	) {
		assert.ok(Array.isArray(actual));
		const required = (expected as { value: unknown[] }).value;
		for (const member of required) {
			assert.ok(
				actual.some((candidate) => {
					try {
						project(candidate, member);
						return true;
					} catch {
						return false;
					}
				}),
				`missing required array member: ${JSON.stringify(member)}`,
			);
		}
		return expected;
	}
	if (Array.isArray(expected)) {
		assert.ok(Array.isArray(actual));
		assert.equal(actual.length, expected.length);
		return actual.map((value, index) => project(value, expected[index]));
	}
	if (expected && typeof expected === "object") {
		assert.ok(actual && typeof actual === "object" && !Array.isArray(actual));
		return Object.fromEntries(
			Object.entries(expected).map(([key, value]) => {
				assert.ok(Object.hasOwn(actual, key), `missing field ${key}`);
				return [
					key,
					project((actual as Record<string, unknown>)[key], value),
				];
			}),
		);
	}
	return actual;
}

function assertFragments(actual: string, expected: string): void {
	const lines = actual
		.split(/\r?\n/)
		.map((line) => line.trim().toLowerCase());
	for (const raw of expected.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line) continue;
		const absent = /^<!-- absent: (.*) -->$/i.exec(line);
		if (absent) {
			const phrase = absent[1] ?? "";
			assert.ok(
				!lines.some((candidate) => candidate.includes(phrase.toLowerCase())),
				`unexpected fragment ${phrase}`,
			);
		} else {
			assert.ok(
				lines.some((candidate) => candidate.includes(line.toLowerCase())),
				`missing fragment ${line}`,
			);
		}
	}
}

async function materialize(t: TestContext, fixture: Fixture) {
	const repository = await tmpRepo("board-conformance");
	t.after(repository.cleanup);
	for (const [filename, contents] of Object.entries(fixture.repo.files))
		await repository.write(filename, contents);
	repository.git(["add", "-A", "-f", "--", "."]);
	repository.git(["commit", "--quiet", "--no-verify", "-m", "fixture"]);
	repository.git(["branch", "-m", "main"]);
	return repository;
}

const suite = new URL("../../pkg/conformance/board/", import.meta.url);
const directories = (await readdir(suite, { withFileTypes: true }))
	.filter((entry) => entry.isDirectory())
	.map(({ name }) => name)
	.sort();
assert.ok(directories.length > 0);

for (const name of directories) {
	test(`independent board ${name} matches its JSON projection and Markdown`, async (t) => {
		const folder = new URL(`${name}/`, suite);
		const fixture: Fixture = JSON.parse(
			await readFile(new URL("input.json", folder), "utf8"),
		);
		const expected: unknown = JSON.parse(
			await readFile(new URL("expected.json", folder), "utf8"),
		);
		const expectedMarkdown = await readFile(
			new URL("expected.md", folder),
			"utf8",
		);
		assert.equal(fixture.operation, "board");
		const repository = await materialize(t, fixture);
		const result = await board({
			cwd: repository.path,
			...fixture.options,
			now: fixture.repo.now,
		});

		for (const field of [
			"schema_version",
			"as_of",
			"read",
			"specs",
			"pending_blessings",
			"spec_debt",
		])
			assert.ok(Object.hasOwn(result, field), `missing board field ${field}`);
		assert.deepEqual(project(result, expected), expected);

		const rendered = renderSpecsBoard(result);
		if (fixture.markdownMode === "fragments") {
			assertFragments(rendered, expectedMarkdown);
			return;
		}
		const firstBreak = rendered.indexOf("\n");
		const header = `${fixture.repo.repository} · main ${fixture.repo.read.main?.slice(0, 7)} · level observe`;
		assert.equal(`${header}${rendered.slice(firstBreak)}`, expectedMarkdown);
	});
}
