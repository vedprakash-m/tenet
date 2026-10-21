// `inspect`: read-only views. `help` and `doctor` are stateless: they never create or read `.tenet/`.
import { LIMITS, summarize } from "../core/budget.ts";
import { isSettingKey, layersOf, resolveSetting } from "../core/config.ts";
import { KernelError } from "../core/errors.ts";
import { nextItem } from "../core/plan.ts";
import { controlsFor } from "../core/controls.ts";
import { handoffText } from "../core/handoff.ts";
import { verdict, headline } from "../core/verdict.ts";
import { InspectInput } from "../core/schemas.ts";
import type { State } from "../core/schemas.ts";
import { assistanceLevel, readinessReport } from "../core/risk.ts";
import type { Plan, Verb } from "../pipeline.ts";
import type { Ports } from "../ports/types.ts";
import { nodeOk, readinessOf, workOf } from "./common.ts";
import { gather, verdictInput } from "./facts.ts";
import { settingsFor, sharedPolicy, withRequiredChecks } from "./reconcile.ts";

const VERBS = {
  open: "open --profile <feature|bug|refactor|investigate|plan|…> --request <text>   start or resume a contract",
  decide: "decide --h <handle> --kind <basis|dirty-overlap|acceptance|disposition|…>   record decisions and proposals",
  check: "check --h <handle> [--stage baseline|candidate] [--targeted] [--touched <paths>]   run the obligations",
  packet: "packet --role <reviewer|handoff|resume> --h <handle> [--retry]   build a review manifest or a handoff",
  findings: "findings --h <handle> < review-result.json   record a review result",
  commit: "commit --h <handle> --subject <text>   checkpoint commit",
  finish: "finish --h <handle> [--no-commit]   verdict, final commit, result",
  integrate: "integrate --h <handle>   merge the work branch into its base locally",
  undo: "undo --h <handle>   preview the inverse of the work's commits; apply with decide undo-confirm",
  stop: "stop --h <handle> --mode <pause|cancel|abandon>   always allowed",
  review: "review [--scope working-tree]   review-only manifest, nothing written to the project",
  inspect: "inspect [--view status|why|doctor|help|settings [--topic <setting>]]   read-only views",
};

function doctor(ports: Ports, probe: Awaited<ReturnType<Ports["git"]["probe"]>>) {
  const writable = ports.store.canWrite();
  const d = ports.stack.detect(ports.root);
  const checks = [
    { name: "node", ok: nodeOk(), detail: process.version },
    { name: "git", ok: probe.version !== "git not found", detail: probe.version },
    { name: "repository", ok: probe.isRepo && probe.state === "ok", detail: probe.isRepo ? (probe.state === "ok" ? `branch ${probe.branch ?? "(detached)"}` : probe.why ?? "read-only") : "not a Git repository" },
    { name: "commit identity", ok: probe.identity, detail: probe.identity ? "configured" : "git user.name and user.email are not set" },
    { name: "project folder writable", ok: writable, detail: ports.root },
    { name: "test runner", ok: d.runnerSupported, detail: d.runner ? `${d.runner} ${d.runnerVersion}${d.runnerSupported ? "" : " (unsupported version)"}` : d.depsInstalled ? "none found" : "dependencies are not installed" },
    { name: "commit hooks", ok: true, detail: probe.hooks ? "present; commits need your consent once" : "none" },
  ];
  const { level, why } = assistanceLevel(readinessOf(ports, probe), "feature");
  const detected = { language: d.language, typescript: d.typescript, packageManager: d.packageManager, runner: d.runner ?? null, depsInstalled: d.depsInstalled, hooks: !!probe.hooks, git: probe.isRepo };
  const readiness = readinessReport(readinessOf(ports, probe));
  return {
    checks, detected, capabilities: ports.host.capabilities(), level, ...(why ? { why } : {}), ok: checks.every((c) => c.ok), readiness,
  };
}

const statusOf = (st: State | null) => ({
  initialized: !!st, revision: st?.revision ?? 0,
  work: Object.values(st?.work ?? {}).map((w) => ({ label: w.label, profile: w.profile, state: w.state, lane: w.lane, ...(w.model ? { model: w.model } : {}), outcome: w.outcome.slice(0, 80), budget: summarize(w.budget, w.lane) })),
  pending: (st?.pending ?? []).map((q) => q.id), sourceOwner: st?.sourceOwner?.work ?? null,
  plan: { items: (st?.project.intent.plan ?? []).map((i) => ({ id: i.id, outcome: i.outcome, state: i.state, dependsOn: i.dependsOn })), next: nextItem(st?.project.intent.plan ?? [])?.id ?? null },
});

export const inspect: Verb<InspectInput> = {
  name: "inspect",
  schema: InspectInput,
  class: (i) => (i.view === "help" || i.view === "doctor" ? "stateless" : "read-only"),

  async run(ports, state, input): Promise<Plan> {
    switch (input.view) {
      case "help": return { resp: { data: { verbs: VERBS } } };
      case "doctor": {
        const d = doctor(ports, await ports.git.probe());
        return { resp: { kernel: true, data: d, ...(d.ok ? {} : { exit: 2 as const }) } };
      }
      case "status": {
        if (input.h) {
          const w = workOf(state, input.h);
          return { resp: { work: w.id, data: { ...statusOf(state), contract: { label: w.label, state: w.state, lane: w.lane, level: w.level, branch: w.git.branch, limits: LIMITS[w.lane] }, handoff: handoffText(state!, w) } } };
        }
        return { resp: { data: statusOf(state) } };
      }
      case "why": {
        const w = withRequiredChecks(ports, state!, workOf(state, input.h));
        if (!w.basis && w.profile !== "plan" && w.profile !== "investigate") return { resp: { work: w.id, data: { why: "No basis is recorded yet, so there is nothing to judge." } } };
        const facts = await gather(ports, w, state!.locks);
        const v = verdict(verdictInput(ports, state!, w, facts));
        const tiers = readinessReport(readinessOf(ports, await ports.git.probe()));
        // every reason a mere note (the same test endpointOf applies) means nothing is currently outstanding
        const blocking = v.reasons.filter((r) => !r.note).map((r) => r.code);
        const action = blocking.length ? { ready: false, blockedBy: blocking } : { ready: true };
        const readiness = {
          action, ...(tiers.plugin.ready ? {} : { plugin: tiers.plugin }), ...(tiers.project.ready ? {} : { project: tiers.project }),
        };
        return {
          resp: {
            work: w.id, reasons: v.reasons,
            data: { endpoint: v.endpoint, scope: v.scope ?? null, label: headline(v, { profile: w.profile, branch: w.git.branch }), readiness, ...controlsFor(w, v.endpoint, ports.host.capabilities()) },
          },
        };
      }
      case "settings": {
        const w = input.h ? workOf(state, input.h) : undefined;
        const revision = state?.config.revision ?? 0;
        if (!input.topic) return { resp: { data: { settings: settingsFor(ports, state, w), revision } } };
        if (!isSettingKey(input.topic)) throw new KernelError("restriction-key-unknown", `"${input.topic}" is not a setting`, { exit: 2 });
        return { resp: { data: { setting: resolveSetting(input.topic, layersOf(state, w, sharedPolicy(ports, state))), revision } } };
      }
      default:
        throw new KernelError("capability-missing", `the "${input.view}" view arrives after M0`, { exit: 1 });
    }
  },
};
