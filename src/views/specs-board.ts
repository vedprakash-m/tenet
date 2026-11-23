import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { git } from "../core/git.js";
import { loadPolicy } from "../policy/index.js";
import { scanTests } from "../reports/scan.js";
import { citationParts } from "../specs/anchors.js";
import { resolveCitations } from "../specs/citations.js";
import { flags } from "../specs/flags.js";
import { ladder } from "../specs/ladder.js";
import {
	parseDoc,
	type ParsedDoc,
	type Requirement,
	type SpecSection,
} from "../specs/parse.js";

type Level = "L0" | "L1" | "L2" | "L3" | "L4";
type State = "draft" | "blessed" | "rejected" | "deferred";
type Flag = "edited" | "sources-changed";

export type BoardSpec = {
	path: string;
	section: string;
	level: Level;
	state: State;
	flags: Flag[];
	recorded?: "self" | "forge" | "signed";
};

export type SpecDebt = {
	kind: "broken-citation" | "untested-requirement" | "over-budget";
	path: string;
	id: string | null;
	message: string;
};

export type SpecsBoard = {
	schema_version: 1;
	as_of: string;
	read: {
		main: string | null;
		branches: string[];
		records: string | null;
	};
	specs: BoardSpec[];
	pending_blessings: Array<{
		path: string;
		section: string;
		conflicts: string[];
		open_questions: string[];
	}>;
	spec_debt: SpecDebt[];
};

export type BoardOptions = {
	all?: boolean;
	cwd?: string;
	now?: Date | string;
};

type SectionDetail = {
	heading: string;
	body: string;
	draftedFrom: boolean;
	changedSource: { id: string; path: string } | null;
};

type RenderDetails = {
	repository: string;
	branch: string | null;
	commit: string | null;
	level: string;
	all: boolean;
	noSpecifications: boolean;
	sections: Map<string, SectionDetail>;
};

const renderDetails = new WeakMap<SpecsBoard, RenderDetails>();
const levelValues = new Set<Level>(["L0", "L1", "L2", "L3", "L4"]);
const stateValues = new Set<State>([
	"draft",
	"blessed",
	"rejected",
	"deferred",
]);

function portable(value: string): string {
	return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function sectionKey(file: string, section: string): string {
	return `${file}\0${section}`;
}

function sectionRecord(doc: ParsedDoc, slug: string): Record<string, unknown> {
	const sections = doc.front?.sections;
	if (!sections || typeof sections !== "object" || Array.isArray(sections))
		return {};
	const value = (sections as Record<string, unknown>)[slug];
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function readAt(cwd: string): (filename: string) => string | null {
	return (filename) => {
		try {
			return readFileSync(
				path.join(cwd, ...portable(filename).split("/")),
				"utf8",
			);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
			throw error;
		}
	};
}

function defaultBudget(filename: string): number | null {
	const lower = filename.toLowerCase();
	if (lower === "agents.md") return 3_000;
	if (lower.endsWith("/now.md")) return 6_000;
	if (lower.endsWith("/vision.md")) return 4_000;
	if (lower.endsWith("/prd.md")) return 9_000;
	if (lower.includes("/prd/") && lower.endsWith(".md")) return 7_000;
	if (lower.endsWith("/catalog.md")) return 7_000;
	if (lower.endsWith("/tech-spec.md")) return 12_000;
	if (lower.endsWith("/ux-spec.md")) return 6_000;
	if (lower.endsWith("/plan.md")) return 6_000;
	if (lower.includes("/plan/") && lower.endsWith(".md")) return 6_000;
	if (lower.includes("/tech-spec/") && lower.endsWith(".md")) return 6_000;
	return null;
}

function asOf(options: BoardOptions): string {
	const now =
		options.now === undefined
			? new Date()
			: options.now instanceof Date
				? options.now
				: new Date(options.now);
	return now.toISOString().replace(".000Z", "Z");
}

async function revision(
	cwd: string,
): Promise<{ full: string | null; short: string | null; branch: string | null }> {
	const [full, branch] = await Promise.all([
		git(["rev-parse", "HEAD"], { cwd }).catch(() => ""),
		git(["branch", "--show-current"], { cwd }).catch(() => ""),
	]);
	const sha = full.trim();
	return {
		full: sha || null,
		short: sha ? sha.slice(0, 7) : null,
		branch: branch.trim() || null,
	};
}

function unresolvedIds(
	doc: ParsedDoc,
	section: string,
	field: "conflicts" | "questions",
): string[] {
	const special = doc.sections.find(
		(candidate) =>
			candidate.slug ===
			(field === "conflicts" ? "conflicts" : "open-questions"),
	);
	if (!special) return [];
	return special[field]
		.filter(
			(item) =>
				!item.checked &&
				!(field === "conflicts" ? item.resolution : item.answer) &&
				item.section === section,
		)
		.map((item) => item.id)
		.sort();
}

function isFlag(
	section: SpecSection,
	readFile: (filename: string) => string | null,
	flag: Flag,
): boolean {
	return flags(section, readFile).includes(flag);
}

function changedSource(
	section: SpecSection,
	readFile: (filename: string) => string | null,
): SectionDetail["changedSource"] {
	for (const cite of section.requirements.flatMap((item) => item.cites)) {
		const expected = section.anchors[cite];
		if (expected === undefined) continue;
		const isolated: SpecSection = {
			...section,
			digest: section.blessed_digest ?? section.digest,
			anchors: { [cite]: expected },
		};
		if (!isFlag(isolated, readFile, "sources-changed")) continue;
		const requirement = section.requirements.find((item) =>
			item.cites.includes(cite),
		);
		const parsed = citationParts(cite);
		if (!requirement || !parsed) continue;
		return { id: requirement.id, path: parsed.path };
	}
	return null;
}

function citationMessage(
	heading: string,
	cite: string,
	code: string,
): string | null {
	const parsed = citationParts(cite);
	switch (code) {
		case "TN-CITE-FILE":
			return parsed
				? `${heading} cites ${parsed.path}, which no longer exists`
				: null;
		case "TN-CITE-HEADING":
			return parsed?.kind === "doc"
				? `${heading} cites ${parsed.path}#${parsed.slug}, which has no heading #${parsed.slug}`
				: null;
		case "TN-CITE-TEST":
			return parsed?.kind === "test"
				? `${heading} cites test ${parsed.segments.join(" > ")} in ${parsed.path}, which was not found`
				: null;
		case "TN-CITE-RANGE":
			return `${heading} cites ${cite}, which is out of range`;
		default:
			return null;
	}
}

function debtForBrokenCitations(
	doc: ParsedDoc,
	section: SpecSection,
	readFile: (filename: string) => string | null,
): SpecDebt[] {
	if (section.state === "rejected") return [];
	const result: SpecDebt[] = [];
	const items: Requirement[] = [...section.requirements, ...section.vision_items];
	for (const item of items) {
		for (const cite of item.cites) {
			const isolated = {
				...doc,
				sections: [
					{
						...section,
						requirements: [{ ...item, cites: [cite] }],
						vision_items: [],
					},
				],
			};
			for (const finding of resolveCitations(isolated, readFile)) {
				const message = citationMessage(section.heading, cite, finding.code);
				if (!message) continue;
				result.push({
					kind: "broken-citation",
					path: doc.path,
					id: item.id,
					message,
				});
			}
		}
	}
	return result;
}

function debtOrder(left: SpecDebt, right: SpecDebt): number {
	const kinds: Record<SpecDebt["kind"], number> = {
		"broken-citation": 0,
		"untested-requirement": 1,
		"over-budget": 2,
	};
	return (
		kinds[left.kind] - kinds[right.kind] ||
		left.path.localeCompare(right.path, "en") ||
		(left.id ?? "").localeCompare(right.id ?? "", "en") ||
		left.message.localeCompare(right.message, "en")
	);
}

export async function board(options: BoardOptions = {}): Promise<SpecsBoard> {
	const cwd = path.resolve(options.cwd ?? process.cwd());
	const policy = await loadPolicy({ cwd });
	const subject = await revision(cwd);
	const readFileAt = readAt(cwd);
	const configured = policy.specs.documents.map((document) => {
		const filename = portable(path.posix.join(policy.paths.records, document.path));
		return {
			path: filename,
			level: document.level,
			budget: document.budget ?? defaultBudget(filename),
		};
	});
	const discovered = await ladder({
		cwd,
		files: configured.map((document) => document.path),
	});
	const entries = await Promise.all(
		discovered.map(async (entry) => ({
			...entry,
			doc: parseDoc(
				entry.path,
				await readFile(path.join(cwd, ...entry.path.split("/")), "utf8"),
				{ prefix: policy.specs.id_prefix },
			),
		})),
	);
	const specs: BoardSpec[] = [];
	const pending: SpecsBoard["pending_blessings"] = [];
	const sectionDetails = new Map<string, SectionDetail>();
	let specDebt: SpecDebt[] = [];

	for (const entry of entries) {
		for (const section of entry.doc.sections) {
			if (
				section.slug === "_preamble" ||
				section.slug === "conflicts" ||
				section.slug === "open-questions"
			)
				continue;
			const rawLevel =
				section.level ??
				entry.level ??
				configured.find((document) => document.path === entry.path)?.level;
			const state = section.state as State;
			if (!rawLevel || !levelValues.has(rawLevel as Level) || !stateValues.has(state))
				continue;
			const sectionFlags = flags(section, readFileAt);
			const raw = sectionRecord(entry.doc, section.slug);
			const recorded = raw.recorded;
			specs.push({
				path: entry.path,
				section: section.slug,
				level: rawLevel as Level,
				state,
				flags: sectionFlags,
				...(state === "blessed" &&
				(recorded === "self" ||
					recorded === "forge" ||
					recorded === "signed")
					? { recorded }
					: {}),
			});
			sectionDetails.set(sectionKey(entry.path, section.slug), {
				heading: section.heading,
				body: section.text,
				draftedFrom:
					typeof (entry.doc.front?.tenet as Record<string, unknown> | undefined)
						?.drafted_from === "string",
				changedSource:
					section.state === "blessed"
						? changedSource(section, readFileAt)
						: null,
			});
			if (
				state === "draft" ||
				(state === "blessed" &&
					(sectionFlags.includes("edited") ||
						sectionFlags.includes("sources-changed")))
			) {
				pending.push({
					path: entry.path,
					section: section.slug,
					conflicts: unresolvedIds(entry.doc, section.slug, "conflicts"),
					open_questions: unresolvedIds(
						entry.doc,
						section.slug,
						"questions",
					),
				});
			}
			specDebt.push(...debtForBrokenCitations(entry.doc, section, readFileAt));
		}
	}

	const scan = subject.full
		? await scanTests("HEAD", {
				cwd,
				id_prefix: policy.specs.id_prefix,
			})
		: { declarations: [], skips: [] };
	const tagged = new Set(
		scan.declarations.flatMap((declaration) => declaration.tags),
	);
	for (const entry of entries) {
		for (const section of entry.doc.sections) {
			if (section.state !== "blessed") continue;
			for (const requirement of section.requirements) {
				if (tagged.has(requirement.id)) continue;
				specDebt.push({
					kind: "untested-requirement",
					path: entry.path,
					id: requirement.id,
					message: `${section.heading} › ${requirement.id} has no tagged test`,
				});
			}
		}
	}

	for (const document of configured) {
		if (document.budget === null) continue;
		const text = await readFile(
			path.join(cwd, ...document.path.split("/")),
			"utf8",
		).catch((error: NodeJS.ErrnoException) => {
			if (error.code === "ENOENT") return null;
			throw error;
		});
		if (text === null) continue;
		const tokens = Math.ceil(text.length / 4);
		if (tokens > document.budget) {
			specDebt.push({
				kind: "over-budget",
				path: document.path,
				id: null,
				message: `${document.path} is over its token budget (${tokens} > ${document.budget} tokens)`,
			});
		}
	}

	specDebt = [...specDebt]
		.filter(
			(debt, index, all) =>
				all.findIndex(
					(candidate) =>
						candidate.kind === debt.kind &&
						candidate.path === debt.path &&
						candidate.message === debt.message,
				) === index,
		)
		.sort(debtOrder);

	const output: SpecsBoard = {
		schema_version: 1,
		as_of: asOf(options),
		read: {
			main: subject.full,
			branches: [],
			records: null,
		},
		specs,
		pending_blessings: pending,
		spec_debt: specDebt,
	};
	renderDetails.set(output, {
		repository: path.basename(cwd),
		branch: subject.branch,
		commit: subject.short,
		level: policy.level,
		all: options.all === true,
		noSpecifications: entries.length === 0,
		sections: sectionDetails,
	});
	return output;
}

function headingFor(
	spec: { path: string; section: string },
	details: RenderDetails | undefined,
): string {
	return (
		details?.sections.get(sectionKey(spec.path, spec.section))?.heading ??
		spec.section
	);
}

export function renderSpecsBoard(board: SpecsBoard): string {
	const details = renderDetails.get(board);
	if (details?.noSpecifications)
		return "No specifications found · run tenet onboard\n";
	const lines: string[] = [];
	if (details) {
		lines.push(
			`${details.repository} · ${[details.branch, details.commit].filter(Boolean).join(" ")} · level ${details.level}`,
		);
	}

	const drafts = board.specs.filter((spec) => spec.state === "draft");
	const sourcesChanged = board.specs.filter((spec) =>
		spec.flags.includes("sources-changed"),
	);
	const edited = board.specs.filter((spec) => spec.flags.includes("edited"));
	const cleanBlessed = board.specs.filter(
		(spec) => spec.state === "blessed" && spec.flags.length === 0,
	);

	if (drafts.length > 0) {
		lines.push(`Waiting for your blessing (${drafts.length})`);
		for (const spec of drafts) {
			const detail = details?.sections.get(sectionKey(spec.path, spec.section));
			const onboarding =
				detail?.draftedFrom === true ||
				/^Undecided since onboarding\.\r?\n?$/i.test(detail?.body ?? "");
			lines.push(
				`  ${headingFor(spec, details)} · ${onboarding ? "undecided since onboarding" : "draft"}`,
			);
		}
	}
	if (sourcesChanged.length > 0) {
		lines.push(`Sources changed (${sourcesChanged.length})`);
		for (const spec of sourcesChanged) {
			const source = details?.sections
				.get(sectionKey(spec.path, spec.section))
				?.changedSource;
			lines.push(
				source
					? `  ${headingFor(spec, details)} › ${source.id} · ${source.path} changed after you blessed it; the blessed text still applies`
					: `  ${headingFor(spec, details)} · sources changed after you blessed it; the blessed text still applies`,
			);
		}
	}
	if (edited.length > 0) {
		lines.push(`Edited (${edited.length})`);
		for (const spec of edited) {
			lines.push(
				`  ${headingFor(spec, details)} · edited since blessing; the blessed text still applies`,
			);
		}
	}
	if (board.spec_debt.length > 0) {
		lines.push(`Spec debt (${board.spec_debt.length})`);
		for (const debt of board.spec_debt) lines.push(`  ${debt.message}`);
	}
	if (details?.all && cleanBlessed.length > 0) {
		lines.push(`Blessed (${cleanBlessed.length})`);
		for (const spec of cleanBlessed)
			lines.push(`  ${headingFor(spec, details)} · blessed`);
	}
	if (lines.length === 1) lines.push("All blessed specifications are current.");
	return `${lines.join("\n")}\n`;
}

export const renderBoard = renderSpecsBoard;
