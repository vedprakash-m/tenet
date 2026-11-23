import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";
import { validate } from "../src/core/schema.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const specDirectory = "tenet/specs/tech-spec";
const schemas = {
	assignment: ["inventory", "skill"],
	board: ["as_of", "pending_blessings"],
	bundle: ["run", "tested", "checks"],
	finding: ["code", "severity", "message"],
	interview: ["questions"],
	inventory: ["revision", "sources"],
	lock: ["integrity", "kit_sha256"],
	manifest: ["created", "blocks", "keys"],
	"proof-card": ["evaluation_id", "badge"],
	"spec-front-matter": ["tenet", "sections"],
	"tenet-yaml": ["kit_path"],
	"test-report": ["runner", "cases"],
	packet: ["stage", "history"],
	loop: ["loop", "steps"],
	pack: ["pack", "phases"],
	"agent-card": [],
};
const schemaAliases = {
	"tenet.yaml": "tenet-yaml",
	"front-matter": "spec-front-matter",
	"tenet.lock": "lock",
};
const acceptanceHeading = /^ {0,3}#{2,3}[ \t]+Acceptance[ \t]*(?:#+[ \t]*)?$/;
const acceptanceItem = /^\s*[-*]\s*(?:\[[ xX]\]\s*)?\[(AB-\d+)\]\s+(.+)$/;
const requirementId = /^(?!AB-|CF-|Q-|V-)[A-Z][A-Z0-9]*-\d+$/;

function markdownParts(source, firstLine = 1) {
	const parts = [];
	let fence;
	for (const [index, text] of source.split(/\r?\n/).entries()) {
		const line = firstLine + index;
		if (fence) {
			const close = text.match(/^ {0,3}(\x60{3,}|~{3,})[ \t]*$/);
			if (
				close &&
				close[1][0] === fence.marker[0] &&
				close[1].length >= fence.marker.length
			) {
				fence.closed = true;
				fence = undefined;
			} else {
				fence.lines.push({ text, line });
			}
			continue;
		}
		const start = text.match(/^ {0,3}(\x60{3,}|~{3,})[ \t]*(.*)$/);
		if (!start || (start[1][0] === "\x60" && start[2].includes("\x60"))) {
			parts.push({ text, line });
			continue;
		}
		const [language = "", label = ""] = start[2].trim().split(/\s+/);
		fence = {
			marker: start[1],
			language: language.toLowerCase(),
			label,
			lines: [],
			line,
		};
		parts.push(fence);
	}
	return parts;
}

export function commandNames(contracts) {
	const sections = contracts.split(/^## /m);
	const commands = sections.find((section) => /^8\. Commands\b/.test(section));
	if (!commands) throw new Error("Contracts §8 command list is missing");
	const names = new Set();
	for (const row of commands.matchAll(/^\|\s*([^|]+)\|/gm)) {
		if (row[1].includes("tenet-runner")) continue;
		for (const [, command] of row[1].matchAll(
			/\x60([a-z][a-z-]*(?: [a-z][a-z-]*)?)(?: --[^\x60]+)?\x60/g,
		)) {
			names.add(command);
		}
	}
	if (names.size === 0) throw new Error("Contracts §8 command list is empty");
	return names;
}

function commandExamples(text, names, executable) {
	const commands = [];
	const groups = new Set(
		[...names]
			.filter((name) => name.includes(" "))
			.map((name) => name.split(" ")[0]),
	);
	const candidates = [
		...text.matchAll(
			/(?<![\w./@-])tenet[ \t]+([a-z][a-z0-9-]*)(?:[ \t]+([a-z][a-z0-9-]*))?|\bnpx(?:[ \t]+-[\w-]+)*[ \t]+@vedprakash-m\/tenet(?:@(?:<[^>]+>|[^\s\x60]+))?[ \t]+([a-z][a-z0-9-]*)(?:[ \t]+([a-z][a-z0-9-]*))?/g,
		),
	];
	for (const match of candidates) {
		const before = text.slice(0, match.index);
		const inline = before.split("\x60").length % 2 === 0;
		if (
			!inline &&
			!(
				executable &&
				/(?:^[ \t>]*|(?:&&|\|\||;)\s*)(?:(?:\$|run:|- run:|>)\s+|npx\s+)?$|\b(?:run|running|invoke|execute|use|then)\s+(?:npx\s+)?$/i.test(
					before,
				)
			)
		)
			continue;
		const first = match[1] ?? match[3];
		const second = match[2] ?? match[4];
		const name = groups.has(first)
			? [first, second].filter(Boolean).join(" ")
			: first;
		if (!names.has(name)) commands.push(name);
	}
	return commands;
}

function schemaName(label, data) {
	const name = schemaAliases[label] ?? label.replace(/\.json$/, "");
	if (name && Object.hasOwn(schemas, name)) return name;
	if (data === null || typeof data !== "object" || Array.isArray(data))
		return undefined;
	if (Object.hasOwn(data, "tenet") || Object.hasOwn(data, "sections"))
		return "spec-front-matter";
	for (const [candidate, keys] of Object.entries(schemas)) {
		if (keys.length && keys.every((key) => Object.hasOwn(data, key)))
			return candidate;
	}
	if (["standard", "level", "specs"].some((key) => Object.hasOwn(data, key)))
		return "tenet-yaml";
	return undefined;
}

function inspectStructured(kind, label, body) {
	let data;
	try {
		if (kind === "JSON") {
			data = JSON.parse(body);
		} else {
			const document = parseDocument(body, { prettyErrors: false });
			if (document.errors.length) {
				return [
					"yaml",
					`Invalid YAML: ${document.errors.map((error) => error.message).join("; ")}`,
				];
			}
			data = document.toJS();
		}
	} catch (error) {
		return [kind.toLowerCase(), `Invalid ${kind}: ${error.message}`];
	}
	const schema = schemaName(label, data);
	if (schema) {
		let result;
		try {
			result = validate(schema, data);
		} catch (error) {
			if (
				!(error instanceof RangeError) ||
				error.message !== `Unknown schema: ${schema}`
			)
				throw error;
			return [
				"schema",
				`Schema example cannot be validated: ${schema} is not registered`,
			];
		}
		if (!result.ok) {
			const details = result.errors.map(
				({ pointer, message }) => `${pointer || "/"} ${message}`,
			);
			return ["schema", `${schema}: ${details.join("; ")}`];
		}
	}
	const badTags = [];
	const visited = new WeakSet();
	function inspectCtrf(object) {
		if (!object || typeof object !== "object" || visited.has(object)) return;
		visited.add(object);
		if (Array.isArray(object)) {
			for (const element of object) inspectCtrf(element);
		} else {
			if (
				object.extra &&
				typeof object.extra === "object" &&
				Object.hasOwn(object.extra, "tenet_cases")
			) {
				const tokens = object.extra.tenet_cases;
				if (
					!Array.isArray(tokens) ||
					tokens.some((token) => typeof token !== "string" || !exactTag(token))
				) {
					badTags.push(
						"extra.tenet_cases must be an array of valid tag tokens",
					);
				}
			}
			for (const child of Object.values(object)) inspectCtrf(child);
		}
	}
	inspectCtrf(data);
	if (badTags.length) return ["tag", [...new Set(badTags)].join("; ")];
	return undefined;
}

function inspectFrontMatter(lines, report) {
	const opening = lines.findIndex(({ text }) => text.trim());
	if (opening === -1 || lines[opening].text.trim() !== "---") return;
	const closing = lines.findIndex(
		({ text }, index) => index > opening && /^\s*---\s*$/.test(text),
	);
	const yaml = lines.slice(opening + 1, closing === -1 ? undefined : closing);
	if (!yaml.some(({ text }) => /^(?:tenet|sections):/.test(text))) return;
	if (closing === -1) {
		report(
			lines[opening].line,
			"schema",
			"Front matter is missing its closing delimiter",
		);
		return;
	}
	const failure = inspectStructured(
		"YAML",
		"spec-front-matter",
		yaml.map(({ text }) => text).join("\n"),
	);
	if (failure) report(lines[opening].line, ...failure);
}
function inspectAcceptance(lines, report) {
	const hasHeading = lines.some(({ text }) => acceptanceHeading.test(text));
	const resemblesAcceptance =
		lines.some(({ text }) => /^ {0,3}#+\s+Acceptance\b/.test(text)) ||
		lines.some(({ text }) => /^Implements:/.test(text));
	if (!hasHeading && resemblesAcceptance) {
		const start = lines.find(({ text }) =>
			/^ {0,3}#+\s+Acceptance\b|^Implements:/.test(text),
		);
		report(
			start.line,
			"acceptance",
			"Acceptance requires the exact level 2 or 3 heading",
		);
		return;
	}
	let inside = false;
	const ids = new Set();
	for (const { text, line } of lines) {
		if (acceptanceHeading.test(text) && !inside) {
			inside = true;
			continue;
		}
		if (!inside) continue;
		if (/^ {0,3}#{1,6}(?:[ \t]|$)/.test(text)) return;
		if (text.startsWith("Implements:")) {
			const ids = text
				.slice("Implements:".length)
				.split(",")
				.map((id) => id.trim())
				.filter(Boolean);
			if (ids.some((id) => !requirementId.test(id)))
				report(line, "acceptance", "Invalid requirement ID in Implements");
		}
		if (!/^\s*[-*]\s/.test(text)) continue;
		const match = text.match(acceptanceItem);
		if (!match?.[2].trim())
			report(
				line,
				"acceptance",
				"Acceptance bullet needs an [AB-n] ID and text",
			);
		else if (ids.has(match[1]))
			report(line, "acceptance", `Repeated acceptance ID: ${match[1]}`);
		else ids.add(match[1]);
	}
}

function exactTag(token) {
	return (
		/^AB-\d+$/.test(token) ||
		requirementId.test(token) ||
		(/^\[.*\]$/.test(token) &&
			exactTag(token.slice(1, -1)) &&
			!token.startsWith("[tenet_") &&
			!token.startsWith("[[")) ||
		(/^tenet_[A-Z][A-Z0-9]*_\d+$/.test(token) &&
			!/^tenet_(?:CF|Q|V)_/.test(token))
	);
}

function inspectTag(line, report, specPrefix, fenced) {
	const property =
		/record_property\(\s*["']tenet\.case["']\s*,\s*(["'])(.*?)\1|<property\b(?=[^>]*\bname=["']tenet\.case["'])[^>]*\bvalue=(["'])(.*?)\3/g;
	for (const match of line.matchAll(property)) {
		const value = (match[2] ?? match[4]).trim();
		if (value === "…" || value === "<tag>") continue;
		const tokens = value.split(/[,\s]+/).filter(Boolean);
		if (tokens.length === 0 || tokens.some((token) => !exactTag(token)))
			report("Invalid tenet.case test tag");
	}
	if (
		!fenced &&
		!/(?:\b(?:it|test|describe|t\.Run)\s*\(|\b(?:def|fn|void)\s+|\btest_|_tenet_|^tenet_|:\s*tenet_)/.test(
			line,
		)
	)
		return;
	for (const [, prefix, number] of line.matchAll(
		/\[([A-Za-z][A-Za-z0-9]*)([-_][^\]]*)\]/g,
	)) {
		if (
			["AB", specPrefix].includes(prefix.toUpperCase()) &&
			!exactTag(prefix + number)
		) {
			report(`Malformed bracketed test tag: [${prefix}${number}]`);
		} else if (
			["AB", specPrefix].includes(prefix.toUpperCase()) &&
			prefix !== prefix.toUpperCase()
		) {
			report(`Malformed bracketed test tag: [${prefix}${number}]`);
		}
	}
	for (const [, token] of line.matchAll(
		/(?:^|[^\w]|_)(tenet_[A-Za-z0-9]+_[A-Za-z0-9]*)/g,
	)) {
		if (!exactTag(token)) report(`Malformed identifier test tag: ${token}`);
	}
}

function inspectCard(lines, report) {
	const proof = lines.findIndex(({ text }) => /^### Tenet proof\b/.test(text));
	if (proof === -1) return;
	const tail = lines.slice(proof + 1).map(({ text }) => text);
	for (const section of [
		/^Your intent this change touches\b/,
		/^Acceptance\s*$/,
		/^Tests\b/,
	]) {
		const index = tail.findIndex((text) => section.test(text));
		if (index === -1) {
			report(
				lines[proof].line,
				"card",
				"Proof card is missing a required section or has sections out of order",
			);
			return;
		}
		tail.splice(0, index + 1);
	}
}

export function inspectExamples(file, source, names, specPrefix = "R") {
	const findings = [];
	const count = { yaml: 0, json: 0 };
	const report = (line, kind, reason) =>
		findings.push({ file, line, kind, reason });
	const parts = markdownParts(source);
	for (const part of parts) {
		if (part.lines) {
			const kind = { yaml: "YAML", yml: "YAML", json: "JSON" }[part.language];
			const body = part.lines.map(({ text }) => text).join("\n");
			if (kind) {
				count[kind.toLowerCase()]++;
				const failure = part.closed
					? inspectStructured(kind, part.label, body)
					: [kind.toLowerCase(), `Unclosed ${kind} fence`];
				if (failure) report(part.line, ...failure);
			}
			if (["", "text", "markdown", "md"].includes(part.language)) {
				const visible = markdownParts(body, part.line + 1).filter(
					(line) => !line.lines,
				);
				inspectFrontMatter(visible, report);
				inspectAcceptance(visible, report);
				inspectCard(visible, report);
			}
		}
		const executable =
			Boolean(part.lines) &&
			!["json", "markdown", "md"].includes(part.language);
		for (const { line, text } of part.lines ?? [part]) {
			for (const name of commandExamples(text, names, executable)) {
				report(line, "command", `Unknown Tenet command: ${name}`);
			}
			if (!text.startsWith("| Test tag |")) {
				const tagText = text.replace(/<ID with underscores>/g, "");
				inspectTag(
					tagText,
					(reason) => report(line, "tag", reason),
					specPrefix,
					Boolean(part.lines),
				);
			}
		}
	}
	return { count, findings };
}

export function compareKnownFailures(findings, known) {
	const key = ({ file, line, reason }) => JSON.stringify([file, line, reason]);
	const matched = new Set();
	const knownKeys = new Set();
	for (const entry of known) {
		if (
			!entry.file ||
			!Number.isInteger(entry.line) ||
			entry.line < 1 ||
			!entry.reason ||
			!entry.proposal ||
			knownKeys.has(key(entry))
		) {
			throw new Error(
				`Invalid or duplicate known example failure: ${key(entry)}`,
			);
		}
		knownKeys.add(key(entry));
	}
	const unexpected = [];
	for (const finding of findings) {
		const id = key(finding);
		if (!knownKeys.has(id) || matched.has(id)) unexpected.push(finding);
		else matched.add(id);
	}
	return {
		unexpected,
		stale: known.filter((entry) => !matched.has(key(entry))),
		matched: matched.size,
	};
}

async function main() {
	const read = (file) => readFile(path.join(root, file), "utf8");
	const entries = await readdir(path.join(root, specDirectory), {
		withFileTypes: true,
	});
	const specParts = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
		.map((entry) => `${specDirectory}/${entry.name}`)
		.sort();
	if (!specParts.length) throw new Error("No tech-spec Markdown files found");
	const files = [
		"README.md",
		"tenet/specs/ux-spec.md",
		"tenet/specs/tech-spec.md",
		...specParts,
	];
	const names = commandNames(await read(`${specDirectory}/contracts.md`));
	const known = JSON.parse(await read("scripts/examples-known.json"));
	const policy = parseDocument(await read("tenet.yaml")).toJS();
	const specPrefix = policy?.specs?.id_prefix ?? "R";
	const results = await Promise.all(
		files.map(async (file) =>
			inspectExamples(file, await read(file), names, specPrefix),
		),
	);
	const findings = results.flatMap((result) => result.findings);
	const counts = results.reduce(
		(total, { count }) => ({
			yaml: total.yaml + count.yaml,
			json: total.json + count.json,
		}),
		{ yaml: 0, json: 0 },
	);
	const { unexpected, stale, matched } = compareKnownFailures(findings, known);
	for (const { file, line, reason } of unexpected)
		console.error(`${file}:${line}: ${reason}`);
	for (const { file, line, reason } of stale)
		console.error(`${file}:${line}: stale known failure: ${reason}`);
	console.log(
		`Checked examples across ${files.length} documents (${counts.yaml} YAML, ${counts.json} JSON fences; ${matched} documented failures).`,
	);
	if (unexpected.length || stale.length) process.exitCode = 1;
}

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	await main();
}
