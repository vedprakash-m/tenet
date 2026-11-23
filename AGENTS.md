# AGENTS.md

This is the map for any agent working in this repository. Read it first; follow links for detail.

## What this repository is

**Tenet** is a tool-neutral standard for governed, spec-driven software factories, plus the minimum tooling to adopt it: a kit of schemas, templates, reference agents and loop definitions, and a deterministic CLI (`tenet`) that never calls a model. This repository runs under the standard it defines.

It is not Tenet for Copilot (the VS Code implementation, in the `tenet-copilot` repository) and not Torus. Do not copy their product requirements here.

## Where things are

Three groups: **`kit/`** is the product content that ships and that projects load, pinned by their lock; **`src/`, `test/`, `pkg/`, `docs/`, `examples/`** are the tool and its supporting files; **`tenet/`** holds this repository's own records, exactly as any project keeps them.

| Path | Level | What | You may |
|---|---|---|---|
| `tenet/vision.md` | L0 | Purpose, north star, horizons, metrics, boundaries | Read only. Only the Owner changes it |
| `tenet/specs/prd.md`, `tenet/specs/prd/{catalog,tooling,decisions}.md` | L1 | The spec process, kernel, trust and adoption requirements; the catalog of standard claims, evidence and decisions; work, views, kit, agent, conformance and adoption requirements (R-nnn); decisions, risks and open questions | Read; propose changes through a `spec` packet |
| `kit/TENET.md` | L1 | The standard. **Until CP-0015 rewrites it, its old text is historical:** the specifications above and below are normative, and where they disagree with it, they win | Read; propose changes through a `spec` packet |
| `tenet/specs/tech-spec.md`, `tenet/specs/tech-spec/{contracts,algorithms,ci,agents,evidence,onboarding}.md` | L2 | Architecture; exact formats, interfaces and error codes (contracts); algorithms with fixtures (ALG-nn); the CI shape, verification and release (ci); what agents are told (agents); onboarding; `<!-- provisional -->` and `<!-- invariant -->` sections need the Owner | Read; propose changes through a `spec` packet |
| `tenet/specs/ux-spec.md` | L2 | CLI output, board, onboarding, wording | Read; propose changes through a `spec` packet |
| `tenet/specs/plan.md`, `tenet/specs/plan/{alpha.0,alpha.0b,alpha.1,alpha.2,0.1.0,0.1.x}.md` | L2 | Milestones, waves and gates; one build contract per packet in its release part. A builder reads its contract and the sections it names | Read; the planner updates it through spec packets |
| `kit/` (schemas, templates, agents, loops, defaults) | Kit | Ships in the package; subscribing projects load it pinned by their lock, or vendor it into `.tenet/kit/` | Change only inside an assigned packet |
| `pkg/` | Kit | Migrations, conformance and host formats ship in the package but are never vendored; `pkg/evals/` stays in the repository and is never published | Change only inside an assigned packet; agents under test never read `pkg/evals/` |
| `tenet/packets/CP-nnnn-*/` | L3 | One folder per change | Work only in your assigned packet |
| `src/`, `test/`, `examples/`, `runner/` | L4 | CLI source, tests, the example project and the reference runner (from M1) | Change only inside your assignment's scope |
| `docs/` | — | User documentation; explains the standard, never adds rules | Change only inside an assigned packet |
| `tenet/ledger/` | — | Decisions, milestones, reviews | Append new files only; never edit one |
| `tenet/holdout/` | — | Scenarios builders never see | **Never read** in a build session |
| `tenet/now.md` | — | The factory floor | Never edit by hand once `tenet board` exists |
| `tenet/design/` | — | Parked designs; `origin/process.md` is the seed the standard grew from | Read only |

## How work flows

1. **Pick a packet** in `tenet/packets/` whose `blocked_by` packets are all closed and which the Owner has assigned. The order is the waves in [plan §2](tenet/specs/plan.md#2-waves).
2. **Read its build contract** in its release part (`tenet/specs/plan/…`) and only the sections it names. Build only what its *Owns* lists.
3. **Prove it** with its *Proving* command. "Done" is computed from that evidence; never claim it.
4. **Disagreements stop the work.** If the contract and a specification disagree, or the contract leaves a decision open, stop and escalate (below); never choose.
5. **Moves:** until the CLI exists (M1), the Owner moves packets by appending to `history` in `packet.yaml`; afterwards only `tenet move` does. Record paths in the specs (`specs/`, `packets/`, `ledger/`…) are relative to `tenet/`.
6. **Spec changes** ride in the pull request that needs them, or in a `spec` packet, with the document owner's approval (PRD R-209). Typos and broken links are clarifications and need only review.

## Rules you must follow

- **Never** edit `tenet/vision.md`, `tenet/ledger/` files that exist, `tenet.yaml`, `kit/agents/**` outside an `agent` packet, or anything under `tenet/holdout/`.
- **Never** weaken, skip or delete a test without an approved change to the packet's acceptance basis.
- **Never** approve, review or judge your own work.
- The CLI must never call a model or make network requests except those PRD R-080 allows.
- The standard must not name a tool, model or vendor as a requirement (PRD R-003); examples and mappings are marked non-normative.
- Use plain words (UX spec §8). Refer to the Owner as "the Owner" or "Ved", with they/them pronouns.
- Commit only when asked. Work is linked through its pull request or packet (DEC-42); the trailers `Tenet-Task`, `Tenet-Req`, `Tenet-Agent`, `Tenet-Run`, `Tenet-Amendment` and `Tenet-Clarification` are optional.

## When to stop

Stop and escalate (standard §11) when tests keep failing after 3 sessions, the same failure repeats 3 times, you flip between two approaches twice, you are over appetite, or the work cannot pass without changing a test, an acceptance criterion or a higher document. Write the report from `kit/templates/escalation.md` in the packet's `escalations/` folder and set the packet to `blocked`.

## Current state

Milestone **M0 (Foundation)**: everything is a draft awaiting the Owner's approval (CP-0001). Do not start M1 packets until CP-0001 closes. See [tenet/now.md](tenet/now.md).

## Stack (from M1)

TypeScript, ESM, Node 22+, `node:test`. Runtime dependencies limited to `yaml`, `ajv`, `ajv-formats`, `commander`, `picomatch`, `fast-xml-parser` (tech spec §1). Must run on Windows, macOS and Linux.
