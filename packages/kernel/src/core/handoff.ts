// The handoff: only facts the harness cannot guarantee (TS §5.5). Conversation history stays with the host.
import { LIMITS } from "./budget.ts";
import type { State, WorkContract } from "./schemas.ts";

export function handoffText(st: State, w: WorkContract): string {
  const l = LIMITS[w.lane];
  const latest = new Map(w.receipts.map((r) => [r.obligation, r]));
  const open = w.findings.filter((f) => !["verified", "withdrawn", "risk-accepted", "deferred", "wont-fix"].includes(f.state));
  const els = st.project.intent.elements.filter((e) => w.basis?.elementIds.includes(e.id));
  return [
    `${w.label} · ${w.profile} · ${w.lane} lane · ${w.level} · ${w.state}${w.stopReason ? ` (stopped: ${w.stopReason})` : ""}`,
    `Outcome: ${w.outcome || w.request.slice(0, 200)}`,
    els.length ? `Basis: ${els.map((e) => `${e.id} ${e.kind}`).join(", ")}` : "Basis: not recorded yet",
    latest.size ? `Checks: ${[...latest.values()].map((r) => `${r.obligation} ${r.status}${r.scope === "targeted" ? " (targeted)" : ""}`).join("; ")}` : "Checks: none run yet",
    open.length ? `Open findings: ${open.map((f) => `${f.id} ${f.severity} ${f.location.path}: ${f.claim}`).join("; ")}` : "Open findings: none",
    `Budget: attempts ${w.budget.attempts}/${l.attempts}, review rounds ${w.budget.reviewRounds}/${l.rounds}, delegations ${w.budget.delegations}/${l.delegations}`,
    `Git: branch ${w.git.branch ?? "none"}, commits ${w.git.commits.length ? w.git.commits.map((c) => c.slice(0, 8)).join(", ") : "none"}`,
  ].join("\n");
}
