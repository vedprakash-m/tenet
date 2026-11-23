import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { sha256 } from "../../dist/core/hash.js";
import { sectionDigest } from "../../dist/specs/sections.js";
import { board, renderSpecsBoard } from "../../dist/views/specs-board.js";
import { tmpRepo } from "../helpers/tmpRepo.ts";

function policy(
	documents: Array<{ path: string; level: string; budget?: number }>,
	prefix = "R",
): string {
	return `${JSON.stringify(
		{
			standard: "0.1.0-alpha.0",
			kit_path: "kit",
			paths: { records: "tenet" },
			level: "observe",
			specs: { id_prefix: prefix, documents },
			owners: [{ id: "payments", name: "Payments", roles: ["owner"] }],
		},
		null,
		2,
	)}\n`;
}

type Section = {
	slug: string;
	heading: string;
	state?: "draft" | "blessed" | "deferred" | "rejected";
	body: string;
	anchors?: Record<string, string>;
	blessedBody?: string;
	recorded?: "self" | "forge" | "signed";
};

function document(name: string, level: string, sections: Section[]): string {
	const front = {
		tenet: { spec: 1, doc: name, level, version: "0.1", owner: "payments" },
		sections: Object.fromEntries(
			sections.map((section) => {
				const blessed = section.state === "blessed";
				return [
					section.slug,
					{
						state: section.state ?? "draft",
						digest: sectionDigest(section.body),
						flags: [],
						...(blessed
							? {
									blessed_digest: sectionDigest(
										section.blessedBody ?? section.body,
									),
									blessed_at_rev: "0123456789012345678901234567890123456789",
									blessed_copy: `tenet/blessed/${section.slug}.md`,
									recorded: section.recorded ?? "self",
									anchors: section.anchors ?? {},
								}
							: {}),
					},
				];
			}),
		),
	};
	return `---\n${JSON.stringify(front, null, 2)}\n---\n${sections
		.map((section) => `## ${section.heading}\n${section.body}`)
		.join("\n")}`;
}

test("board handles an empty specification configuration and fresh drafts", async () => {
	const repository = await tmpRepo("board-empty");
	try {
		await repository.write("tenet.yaml", policy([]));
		repository.git(["add", "."]);
		repository.git(["commit", "-m", "fixture"]);
		const empty = await board({
			cwd: repository.path,
			now: "2026-11-23T10:00:00Z",
		});
		assert.deepEqual(empty.specs, []);
		assert.deepEqual(empty.pending_blessings, []);
		assert.deepEqual(empty.spec_debt, []);
		assert.equal(
			renderSpecsBoard(empty),
			"No specifications found · run tenet onboard\n",
		);

		await repository.write(
			"tenet.yaml",
			policy([{ path: "intent.md", level: "L1" }]),
		);
		await repository.write(
			"tenet/intent.md",
			document("intent", "L1", [
				{
					slug: "experience",
					heading: "Experience",
					body: "Show checkout.",
				},
			]),
		);
		repository.git(["add", "."]);
		repository.git(["commit", "-m", "draft"]);
		const drafted = await board({
			cwd: repository.path,
			now: "2026-11-23T10:00:00Z",
		});
		assert.deepEqual(drafted.specs, [
			{
				path: "tenet/intent.md",
				section: "experience",
				level: "L1",
				state: "draft",
				flags: [],
			},
		]);
		assert.deepEqual(drafted.pending_blessings, [
			{
				path: "tenet/intent.md",
				section: "experience",
				conflicts: [],
				open_questions: [],
			},
		]);
	} finally {
		await repository.cleanup();
	}
});

test("board adds clean blessed sections only with all", async () => {
	const repository = await tmpRepo("board-all");
	const requirement = "- R-1 Keep retries bounded. {origin: asked}";
	try {
		await repository.write(
			"tenet.yaml",
			policy([{ path: "intent.md", level: "L1" }]),
		);
		await repository.write(
			"tenet/intent.md",
			document("intent", "L1", [
				{
					slug: "requirements",
					heading: "Requirements",
					state: "blessed",
					body: requirement,
				},
			]),
		);
		await repository.write("tenet/blessed/requirements.md", requirement);
		await repository.write(
			"test/retry.test.js",
			"test('[R-1] keeps retries bounded', () => {});\n",
		);
		repository.git(["add", "."]);
		repository.git(["commit", "-m", "fixture"]);

		const normal = await board({
			cwd: repository.path,
			now: "2026-11-23T10:00:00Z",
		});
		assert.equal(normal.specs.length, 1);
		assert.equal(normal.specs[0]?.state, "blessed");
		assert.equal(
			renderSpecsBoard(normal),
			[
				`${path.basename(repository.path)} · master ${normal.read.main?.slice(0, 7)} · level observe`,
				"All blessed specifications are current.",
				"",
			].join("\n"),
		);
		const all = await board({
			cwd: repository.path,
			all: true,
			now: "2026-11-23T10:00:00Z",
		});
		assert.deepEqual(all.specs, [
			{
				path: "tenet/intent.md",
				section: "requirements",
				level: "L1",
				state: "blessed",
				flags: [],
				recorded: "self",
			},
		]);
		assert.deepEqual(all.specs, normal.specs);
		assert.match(
			renderSpecsBoard(all),
			/Blessed \(1\)\n {2}Requirements · blessed\n$/,
		);
	} finally {
		await repository.cleanup();
	}
});

test("board reports edited text and changed cited sources separately", async () => {
	const repository = await tmpRepo("board-flags");
	const blessedSource = "const limit = 1;";
	const oldText = "- R-1 Retry once. {origin: asked; cites: src/retry.ts:1}";
	const editedText = "- R-1 Never retry. {origin: asked}";
	try {
		await repository.write(
			"tenet.yaml",
			policy([{ path: "intent.md", level: "L1" }]),
		);
		await repository.write(
			"tenet/intent.md",
			document("intent", "L1", [
				{
					slug: "requirements",
					heading: "Requirements",
					state: "blessed",
					body: oldText,
					anchors: { "src/retry.ts:1": `sha256:${sha256(blessedSource)}` },
				},
				{
					slug: "limits",
					heading: "Limits",
					state: "blessed",
					body: editedText,
					blessedBody: "- R-1 Retry once. {origin: asked}",
				},
			]),
		);
		await repository.write("src/retry.ts", "const limit = 2;\n");
		await repository.write(
			"test/retry.test.js",
			"test('[R-1] retry policy', () => {});\n",
		);
		repository.git(["add", "."]);
		repository.git(["commit", "-m", "fixture"]);

		const result = await board({
			cwd: repository.path,
			now: "2026-11-23T10:00:00Z",
		});
		assert.equal(result.specs.length, 2);
		assert.equal(
			result.specs.find((item) => item.section === "requirements")?.flags[0],
			"sources-changed",
		);
		assert.equal(
			result.specs.find((item) => item.section === "limits")?.flags[0],
			"edited",
		);
		assert.match(renderSpecsBoard(result), /Sources changed \(1\)/);
		assert.match(renderSpecsBoard(result), /Edited \(1\)/);
		assert.equal(
			result.pending_blessings.filter((item) => item.section === "requirements")
				.length,
			1,
		);
		assert.equal(
			result.pending_blessings.filter((item) => item.section === "limits")
				.length,
			1,
		);
	} finally {
		await repository.cleanup();
	}
});

test("board detects every independent spec-debt kind", async () => {
	const repository = await tmpRepo("board-debt");
	try {
		await repository.write(
			"tenet.yaml",
			policy([
				{
					path: "intent.md",
					level: "L1",
					budget: 80,
				},
			]),
		);
		await repository.write(
			"tenet/intent.md",
			document("intent", "L1", [
				{
					slug: "requirements",
					heading: "Requirements",
					state: "blessed",
					body: `- R-1 Use the queue. {origin: asked; cites: src/legacy/queue.ts:1}
- R-2 Bound retries. {origin: asked}`,
				},
			]),
		);
		await repository.write(
			"test/retry.test.js",
			"test('[R-1] queue', () => {});\n",
		);
		repository.git(["add", "."]);
		repository.git(["commit", "-m", "fixture"]);

		const result = await board({
			cwd: repository.path,
			now: "2026-11-23T10:00:00Z",
		});
		assert.deepEqual(
			result.spec_debt.map((debt) => debt.kind),
			["broken-citation", "untested-requirement", "over-budget"],
		);
		assert.equal(result.spec_debt[1]?.id, "R-2");
		assert.equal(
			result.spec_debt[0]?.message,
			"Requirements cites src/legacy/queue.ts, which no longer exists",
		);
		assert.equal(
			result.spec_debt[1]?.message,
			"Requirements › R-2 has no tagged test",
		);
		assert.equal(result.spec_debt[2]?.id, null);
		assert.match(
			result.spec_debt[2]?.message ?? "",
			/^tenet\/intent\.md is over its token budget \(\d+ > 80 tokens\)$/,
		);
		assert.match(renderSpecsBoard(result), /Spec debt \(3\)/);
	} finally {
		await repository.cleanup();
	}
});

test("board result validates against its owned result schema", async () => {
	const repository = await tmpRepo("board-schema");
	try {
		await repository.write("tenet.yaml", policy([]));
		repository.git(["add", "."]);
		repository.git(["commit", "-m", "fixture"]);
		const result = await board({
			cwd: repository.path,
			now: "2026-11-23T10:00:00Z",
		});
		const schema = JSON.parse(
			await readFile(
				path.join(process.cwd(), "kit", "schemas", "results", "board.json"),
				"utf8",
			),
		);
		const ajv = new Ajv2020({ allErrors: true, strict: true });
		addFormats(ajv);
		const validate = ajv.compile(schema);
		assert.equal(validate(result), true, JSON.stringify(validate.errors));
		assert.equal(
			validate({
				...result,
				spec_debt: [
					{
						kind: "over-budget",
						path: "tenet/intent.md",
						id: null,
					},
				],
			}),
			false,
		);
	} finally {
		await repository.cleanup();
	}
});

test("board renders the UX Part 2 example deterministically", async () => {
	const repository = await tmpRepo("checkout");
	const cited =
		"- C-4 Retry once. {origin: asked; serves: V-1; cites: src/retry.ts:1}";
	try {
		await repository.write(
			"tenet.yaml",
			policy(
				[
					{ path: "specs/prd.md", level: "L1" },
					{ path: "specs/tech-spec.md", level: "L2" },
					{ path: "specs/ux-spec.md", level: "L2" },
				],
				"C",
			),
		);
		await repository.write(
			"tenet/specs/prd.md",
			document("prd", "L1", [
				{
					slug: "requirements",
					heading: "Requirements",
					state: "blessed",
					body: cited,
					anchors: { "src/retry.ts:1": `sha256:${sha256("const limit = 1;")}` },
				},
			]),
		);
		await repository.write(
			"tenet/specs/tech-spec.md",
			document("tech-spec", "L2", [
				{
					slug: "design",
					heading: "Design",
					state: "deferred",
					body: "- C-5 Use the checkout queue. {origin: asked; cites: src/legacy/queue.ts:1}",
				},
			]),
		);
		await repository.write(
			"tenet/specs/ux-spec.md",
			document("ux-spec", "L2", [
				{
					slug: "experience",
					heading: "Experience",
					body: "Undecided since onboarding.",
				},
			]),
		);
		await repository.write("src/retry.ts", "const limit = 2;\n");
		await repository.write(
			"test/retry.test.js",
			"test('[C-4] retry', () => {});\ntest('[C-5] queue', () => {});\n",
		);
		repository.git(["add", "."]);
		repository.git(["commit", "-m", "fixture"]);
		repository.git(["branch", "-m", "main"]);

		const result = await board({
			cwd: repository.path,
			now: "2026-11-23T10:00:00Z",
		});
		const rendered = renderSpecsBoard(result);
		const repositoryName = path.basename(repository.path);
		const commit = repository.git(["rev-parse", "--short=7", "HEAD"]).trim();
		assert.equal(
			rendered,
			[
				`${repositoryName} · main ${commit} · level observe`,
				"Waiting for your blessing (1)",
				"  Experience · undecided since onboarding",
				"Sources changed (1)",
				"  Requirements › C-4 · src/retry.ts changed after you blessed it; the blessed text still applies",
				"Spec debt (1)",
				"  Design cites src/legacy/queue.ts, which no longer exists",
				"",
			].join("\n"),
		);
	} finally {
		await repository.cleanup();
	}
});
