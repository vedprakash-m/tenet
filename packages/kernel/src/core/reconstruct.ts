// Project intent read back from INTENT.md after `.tenet/` is lost (CON-07, TS §15.3). Pure: text in, records out.
// A block is recovered only when rendering what was read gives the file's text again; any other block is listed as
// not recovered, never guessed. Nothing read here is evidence or authority: no receipt, grant, trust entry or lock.
import { KIND_PREFIX } from "./ids.ts";
import { blockHash, parseBlocks, renderIntent } from "./intent-md.ts";
import type { BasisElement, DecisionRecord, PlanItem, State } from "./schemas.ts";

type Intent = State["project"]["intent"];
type Kind = BasisElement["kind"];
type Part = { elements: BasisElement[]; plan: PlanItem[]; records: DecisionRecord[]; overview?: Intent["overview"] };
export type Recovered = { ok: true; intent: Intent; ids: string[]; skipped: string[] } | { ok: false; where: string };

const KIND = Object.fromEntries(Object.entries(KIND_PREFIX).map(([kind, prefix]) => [prefix, kind])) as Record<string, Kind>;
const NO_CHECK = { notApplicable: "a decision carries no check of its own" };
const PLAN = /^\*\*(PLN-\S+) (.*)\*\* \((proposed|accepted|in-progress|done|dropped)\)$/;
const RECORD = /^\*\*(DEC-\S+) (.*)\*\* \((accepted|superseded), (\d{4}-\d{2}-\d{2})\)$/;
const UNTIL = / \(until ([^()]*)\)$/;

/** `ID text (until date)`; the kind comes from the ID's prefix. Recovered elements carry no verification links. */
function element(line: string, of?: string): BasisElement | undefined {
  const at = line.indexOf(" ");
  const id = line.slice(0, at), kind = KIND[id.split("-")[0]!];
  if (at < 1 || !kind) return undefined;
  const u = UNTIL.exec(line);
  const text = line.slice(at + 1, u ? u.index : undefined);
  const verifiedBy = kind === "decision" ? NO_CHECK : [];
  return { id, origin: "tenet", kind, text, ...(of ? { of } : {}), ...(u ? { expiresAt: u[1]! } : {}), verifiedBy };
}

const items = (lines: string[], label: string): string[] => {
  const at = lines.indexOf(`**${label}**`);
  if (at < 0) return [];
  const out: string[] = [];
  for (const l of lines.slice(at + 1)) { if (!l.startsWith("- ")) break; out.push(l.slice(2)); }
  return out;
};
const field = (lines: string[], prefix: string): string | undefined => lines.find((l) => l.startsWith(prefix))?.slice(prefix.length);

function overview(lines: string[]): Part {
  const purpose = field(lines, "**Purpose** ") ?? "", users = field(lines, "**Users** ") ?? "";
  const preferences = items(lines, "Preferences"), nonGoals = items(lines, "Non-goals");
  return { elements: [], plan: [], records: [], overview: { purpose, users, preferences, nonGoals } };
}

function planItem(m: RegExpExecArray, lines: string[]): Part {
  const deps = field(lines, "- depends on: ");
  const item: PlanItem = {
    id: m[1]!, outcome: m[2]!, elementIds: [], dependsOn: deps ? deps.split(", ") : [], check: field(lines, "- check: ") ?? "",
    state: m[3] as PlanItem["state"],
  };
  return { elements: [], plan: [item], records: [] };
}

function record(m: RegExpExecArray, lines: string[]): Part {
  const [, id, title, status, date] = m as unknown as string[];
  const decision = field(lines, "- Decision: ") ?? "", affects = field(lines, "- Affects: "), supersedes = field(lines, "- Supersedes ");
  const alternatives = lines.filter((l) => l.startsWith("- Considered ")).map((l) => {
    const rest = l.slice("- Considered ".length), at = rest.indexOf(": ");
    return { option: rest.slice(0, at), why: rest.slice(at + 2) };
  });
  const rec: DecisionRecord = {
    id: id!, title: title!, status: status as DecisionRecord["status"], date: date!, context: field(lines, "- Context: ") ?? "", decision,
    consequences: field(lines, "- Consequences: ") ?? "", alternatives, links: affects ? affects.split(", ") : [], quote: "",
    ...(supersedes ? { supersedes } : {}),
  };
  const e: BasisElement = { id: id!, origin: "tenet", kind: "decision", text: `${title}: ${decision}`, verifiedBy: NO_CHECK };
  return { elements: [e], plan: [], records: [rec] };
}

function part(id: string, body: string): Part | undefined {
  const lines = body.replace(/\r\n/g, "\n").trimEnd().split("\n");
  const head = lines[0] ?? "";
  if (id === "OVERVIEW") return overview(lines);
  const m = PLAN.exec(head) ?? RECORD.exec(head);
  if (m) return m[1] === id ? (m[0].startsWith("**PLN-") ? planItem(m, lines) : record(m, lines)) : undefined;
  const top = /^\*\*(.*)\*\*$/.exec(head);
  const e = top ? element(top[1]!) : undefined;
  if (!e || e.id !== id) return undefined;
  const children = lines.slice(1).map((l) => (l.startsWith("- ") ? element(l.slice(2), id) : undefined));
  return children.every(Boolean) ? { elements: [e, ...(children as BasisElement[])], plan: [], records: [] } : undefined;
}

const merge = (parts: Part[]): Intent => ({
  revision: 0,
  overview: parts.find((p) => p.overview)?.overview ?? { purpose: "", users: "", preferences: [], nonGoals: [] },
  elements: parts.flatMap((p) => p.elements), plan: parts.flatMap((p) => p.plan), records: parts.flatMap((p) => p.records),
});

/** The intent INTENT.md still shows. Damaged markers recover nothing; the caller reports where they are. */
export function recoverIntent(text: string): Recovered {
  const parsed = parseBlocks(text);
  if (!parsed.ok) return { ok: false, where: `line ${parsed.line}${parsed.id ? ` around ${parsed.id}` : ""} (${parsed.problem})` };
  const skipped: string[] = [], kept = new Map<string, Part>(), seen = new Set<string>();
  for (const b of parsed.blocks) {
    const p = part(b.id, text.slice(b.bodyStart, b.bodyEnd));
    const ids = p ? [...p.elements, ...p.plan].map((x) => x.id) : [];
    if (!p || ids.some((x) => seen.has(x))) { skipped.push(b.id); continue; }
    ids.forEach((x) => seen.add(x));
    kept.set(b.id, p);
  }
  const rendered = renderIntent(merge([...kept.values()]));
  for (const b of parsed.blocks) {
    if (!kept.has(b.id)) continue;
    const want = rendered.get(b.id);
    if (want === undefined || blockHash(want) !== blockHash(text.slice(b.bodyStart, b.bodyEnd))) { kept.delete(b.id); skipped.push(b.id); }
  }
  // Plan items come back `proposed`: a state in the file is not proof that the work was accepted or done.
  const read = merge([...kept.values()]);
  const intent = { ...read, plan: read.plan.map((i) => ({ ...i, state: "proposed" as const })) };
  return { ok: true, intent, ids: [...intent.elements, ...intent.plan].map((x) => x.id), skipped };
}

