import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { config } from "../src/decisions/simple.ts";
import { layersOf, unavailableExecution } from "../src/core/config.ts";
import { isStaticCheck } from "../src/core/obligations.ts";
import { formatHandle } from "../src/core/ids.ts";
import type { State2 } from "../src/core/schemas.ts";
import { upcastState1 } from "../src/core/schemas-upcast.ts";
import { decide } from "../src/verbs/decide.ts";
import { ctx } from "./support/migration-ctx.ts";
import { state1 } from "./support/schema1-fixtures.ts";

const initial = () => upcastState1(state1(), ctx);
const workId = (state: State2) => Object.keys(state.work)[0]!;
const withSecondWork = (state: State2) => {
  const first = state.work[workId(state)]!;
  const id = `${first.id}-second`;
  const second = {
    ...first,
    id,
    label: "W-9999",
    session: { ...first.session, generation: first.session.generation + 1 },
    configEvidence: { ...first.configEvidence },
  };
  state.work[id] = second;
  state.recovery.validity.push({
    key: { workspaceId: state.workspaceId, work: id },
    hash: second.configEvidence.hash,
    serial: second.configEvidence.serial,
  });
  return state;
};
const handle = (state: State2, id = workId(state)) => {
  const work = state.work[id]!;
  return formatHandle(Number(work.label.slice(2)), work.session.generation, state.tag);
};
const ports = (policy: string | null = null) => ({
  project: { read: (path: string) => path === "tenet.policy.json" ? policy : null },
}) as never;
const unrelatedQuestion = (id: string) => ({
  id, header: "Unrelated question", question: "Keep this question.",
  channel: "native" as const, bind: { factsHash: "unrelated" },
});
const unrelatedObligation = () => ({
  id: "OB-unrelated", kind: "test" as const, category: "acceptance" as const,
  targeted: true, tool: "vitest", testFile: "src/other.test.ts", test: "boundary" as const,
  expectation: "pass" as const, state: "registered" as const,
});
const call = (state: State2, input: Record<string, unknown>, policy: string | null = null) => {
  const id = workId(state);
  return config.runCandidate({ ports: ports(policy), state, work: state.work[id]!, input: {
    h: handle(state, id), kind: "config", ...input,
  } });
};

describe("schema-2 candidate decide config D2/D6 flow", () => {
  it("previews a command change, binds the repeated proposal, and refreshes every work on confirm", () => {
    const before = withSecondWork(initial());
    before.pending.push(unrelatedQuestion("unrelated"));
    const proposal = { target: "commands", propose: { value: { build: { argv: ["npm", "run", "build"] } } } };
    const preview = call(before, proposal);
    assert.equal(preview.resp.exit, 3);
    assert.equal(preview.state.config.revision, before.config.revision);
    const question = preview.resp.questions![0]!;
    assert.equal(question.id, `config-confirm:${before.work[workId(before)]!.id}:${before.work[workId(before)]!.session.generation}`);
    assert.equal(Object.keys(preview.state.pending.filter((q) => q.id.startsWith("config-confirm:"))).length, 1);
    const confirmed = call(preview.state, {
      ...proposal, answers: { [question.id]: "confirm" },
    });
    assert.equal(confirmed.resp.exit, 0);
    assert.equal(confirmed.state.config.local.commands && Object.keys(confirmed.state.config.local.commands).length, 1);
    assert.equal(confirmed.state.config.revision, before.config.revision + 1);
    for (const [id, work] of Object.entries(confirmed.state.work)) {
      assert.equal(work.configEvidence.serial, before.work[id]!.configEvidence.serial + 1);
      assert.ok(confirmed.state.recovery.validity.some((floor) => floor.key.work === id
        && floor.serial === work.configEvidence.serial && floor.hash === work.configEvidence.hash));
    }
    assert.ok(!confirmed.state.pending.some((q) => q.id === question.id));
    assert.ok(confirmed.state.pending.some((q) => q.id === "unrelated"));
  });

  it("refuses a stale confirmation and keeps unrelated pending questions", () => {
    const before = initial();
    before.pending.push(unrelatedQuestion("unrelated"));
    const policy = '{"required_checks":[{"id":"RC-1","property":"types"}]}';
    const proposal = { target: "required_checks", propose: { value: [{ id: "RC-1", property: "lint" }] } };
    const preview = call(before, proposal, policy);
    const question = preview.resp.questions![0]!;
    const changedSource = call(preview.state, {
      ...proposal, answers: { [question.id]: "confirm" },
    }, '{"required_checks":[{"id":"RC-1","property":"types"},{"id":"RC-2","property":"lint"}]}');
    assert.equal(changedSource.resp.exit, 2);
    assert.equal(changedSource.state.config.revision, before.config.revision);
    assert.deepEqual(changedSource.state.config.local, before.config.local);
    assert.ok(changedSource.state.pending.some((q) => q.id === question.id));
    assert.ok(changedSource.state.pending.some((q) => q.id === "unrelated"));

    const changedWork = structuredClone(preview.state);
    changedWork.work[workId(changedWork)]!.obligations.push(unrelatedObligation());
    const staleWork = call(changedWork, {
      ...proposal, answers: { [question.id]: "confirm" },
    }, policy);
    assert.equal(staleWork.resp.exit, 2);
    assert.equal(staleWork.state.config.revision, before.config.revision);
    assert.deepEqual(staleWork.state.config.local, before.config.local);
    assert.ok(staleWork.state.pending.some((q) => q.id === question.id));
  });

  it("does not partially apply a D6 subset for a stale confirmation answer", () => {
    const before = initial();
    const currentWork = before.work[workId(before)]!;
    const id = `config-confirm:${currentWork.id}:${currentWork.session.generation}`;
    before.pending.push({
      id, header: "Confirm configuration change", question: "Stale question.",
      channel: "native", bind: { factsHash: "stale" },
    });
    const result = call(before, {
      propose: { scope: "project", settings: {
        protected_paths: ["docs/private/**", "../outside/**"],
        commands: { build: { argv: [] } },
      } },
      answers: { [id]: "confirm" },
    });
    assert.equal(result.resp.exit, 2);
    assert.deepEqual(result.state.config.local, before.config.local);
    assert.equal(result.state.config.revision, before.config.revision);
    assert.deepEqual(result.state.pending, before.pending);
  });

  it("requires D2 confirmation when a local required-check change is masked by a shared conflict", () => {
    const before = initial();
    before.config.local.required_checks = [{ id: "RC-1", property: "types" }];
    const shared = '{"required_checks":[{"id":"RC-1","property":"lint"}]}';
    const proposal = { target: "required_checks", propose: { value: [{ id: "RC-1", property: "security" }] } };
    const preview = call(before, proposal, shared);
    assert.equal(preview.resp.exit, 3);
    assert.deepEqual(preview.state.config.local, before.config.local);
    assert.equal(preview.state.config.revision, before.config.revision);
    assert.equal(preview.resp.questions?.length, 1);
  });

  it("does not stale a command confirmation or identity on unrelated work protection or obligation changes", async () => {
    const before = withSecondWork(initial());
    const proposal = { target: "commands", propose: { value: { build: { argv: ["npm", "run", "build"] } } } };
    const preview = call(before, proposal);
    assert.equal(preview.resp.exit, 3);
    const question = preview.resp.questions![0]!;
    const identityInput = {
      h: handle(preview.state), kind: "config",
      target: "commands", propose: { value: { build: { argv: ["npm", "run", "build"] } } },
    };
    const originalIdentity = await decide.identity!(ports(null), identityInput, preview.state);
    const changed = structuredClone(preview.state);
    const second = Object.values(changed.work).find((w) => w.id !== workId(changed))!;
    second.scope.protected.push("unrelated/**");
    second.obligations.push(unrelatedObligation());
    assert.deepEqual(await decide.identity!(ports(null), identityInput, changed), originalIdentity);
    const confirmed = call(changed, { ...proposal, answers: { [question.id]: "confirm" } });
    assert.equal(confirmed.resp.exit, 0);
    assert.deepEqual(confirmed.state.work[second.id]!.scope.protected, second.scope.protected);
    assert.equal(confirmed.state.work[second.id]!.obligations.at(-1)?.testFile, "src/other.test.ts");
  });

  it("does not make an unsupported required-check property eligible for a fixed-tool proof", () => {
    const before = initial();
    const work = before.work[workId(before)]!;
    const intrinsic = { id: "OB-types", kind: "static" as const, category: "boundary" as const, tool: "tsc" as const };
    work.obligations.push(intrinsic);
    const result = call(before, {
      target: "required_checks",
      propose: { value: [{ id: "OB-types", property: "security", tool: "tsc" }] },
    });
    assert.equal(result.resp.exit, 0);
    assert.equal(isStaticCheck({ id: "OB-types", property: "security", tool: "tsc" }), false);
    const blockers = unavailableExecution(layersOf(result.state, result.state.work[workId(result.state)]!, { }));
    assert.ok(blockers.some((blocker) => blocker.includes("OB-types")));
    assert.deepEqual(result.state.work[workId(result.state)]!.obligations.filter((ob) => ob.id === "OB-types"), [intrinsic]);
  });

  it("applies only the restriction-only safe subset of a malformed batch and reports rejected members", () => {
    const before = initial();
    const result = call(before, { propose: { scope: "project", settings: {
      protected_paths: ["docs/private/**", "../outside/**"],
      commands: { build: { argv: [] } },
      style: "not-a-style",
    } } });
    assert.equal(result.resp.exit, 2);
    assert.deepEqual(result.state.config.local.protected_paths, ["docs/private/**"]);
    assert.equal(result.state.config.local.commands, undefined);
    assert.equal(result.state.config.local.style, undefined);
    const data = result.resp.data as { applied: string[]; rejected: Array<{ path: string }> };
    assert.deepEqual(data.applied, ["protected_paths[0]"]);
    assert.ok(data.rejected.some((r) => r.path === "protected_paths[1]"));
    assert.ok(data.rejected.some((r) => r.path.startsWith("commands")));
    assert.ok(data.rejected.some((r) => r.path === "style"));
    for (const [id, work] of Object.entries(result.state.work)) {
      assert.equal(work.configEvidence.serial, before.work[id]!.configEvidence.serial + 1);
    }
  });

  it("makes pre-cache identity depend on config proposal, current question and relevant policy bytes only", async () => {
    const state = initial();
    const input = { h: handle(state), kind: "config", target: "commands", propose: { value: { build: { argv: ["npm", "run", "build"] } } } };
    const a = await decide.identity!(ports(null), input, state);
    const policyChanged = await decide.identity!(ports('{"protected_paths":["changed/**"]}'), input, state);
    assert.notEqual(a, policyChanged);
    const unrelated = structuredClone(state);
    unrelated.config.local.style = "concise";
    assert.deepEqual(await decide.identity!(ports(null), input, unrelated), a);
    const preview = call(state, { target: "commands", propose: { value: { build: { argv: ["npm", "run", "build"] } } } });
    assert.notEqual(await decide.identity!(ports(null), input, preview.state), a);
  });

  it("adds newly required static obligations before refreshing every work binding", () => {
    const before = withSecondWork(initial());
    const result = call(before, { target: "required_checks", propose: {
      value: [{ id: "types", property: "the project compiles" }],
    } });
    assert.equal(result.resp.exit, 0);
    for (const [id, work] of Object.entries(result.state.work)) {
      assert.ok(work.obligations.some((obligation) => obligation.id === "OB-types"));
      assert.equal(work.configEvidence.serial, before.work[id]!.configEvidence.serial + 1);
      assert.ok(result.state.recovery.validity.some((floor) => floor.key.work === id
        && floor.serial === work.configEvidence.serial && floor.hash === work.configEvidence.hash));
    }
  });

  it("preserves an existing question on a no-op and refuses to use it as confirmation", () => {
    const before = initial();
    before.config.local.style = "concise";
    const current = before.work[workId(before)]!;
    const id = `config-confirm:${current.id}:${current.session.generation}`;
    before.pending.push(unrelatedQuestion(id));
    const proposal = { target: "style", propose: { value: "concise", scope: "project" } };
    const noop = call(before, proposal);
    assert.equal(noop.resp.exit, 0);
    assert.equal((noop.resp.data as { changed: boolean }).changed, false);
    assert.deepEqual(noop.state.pending, before.pending);
    const answered = call(before, { ...proposal, answers: { [id]: "confirm" } });
    assert.equal(answered.resp.exit, 2);
    assert.deepEqual(answered.state.pending, before.pending);
  });

  it("withholds valid command members from a D6 safe subset and reports them", () => {
    const before = initial();
    const result = call(before, { propose: { scope: "project", settings: {
      protected_paths: ["docs/private/**", "../outside/**"],
      commands: { build: { argv: ["npm", "run", "build"] } },
      style: "not-a-style",
    } } });
    assert.equal(result.resp.exit, 2);
    assert.equal(result.state.config.local.commands, undefined);
    const data = result.resp.data as { applied: string[]; rejected: Array<{ path: string; message?: string }> };
    assert.deepEqual(data.applied, ["protected_paths[0]"]);
    assert.ok(data.rejected.some((r) => r.path === "commands" && /not eligible/.test(r.message ?? "")));
  });

  it("reads the shared policy once for parsing and confirmation binding", () => {
    const state = initial();
    let reads = 0;
    const source = '{"protected_paths":["src/private/**"]}';
    const result = config.runCandidate({
      ports: { project: { read(path: string) { reads++; assert.equal(path, "tenet.policy.json"); return source; } } } as never,
      state,
      work: state.work[workId(state)]!,
      input: {
        h: handle(state), kind: "config", target: "commands",
        propose: { value: { build: { argv: ["npm", "run", "build"] } } },
      },
    });
    assert.equal(result.resp.exit, 3);
    assert.equal(reads, 1);
  });
});
