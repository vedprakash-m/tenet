# AGENTS.md

This is the map for any agent working in this repository. Read it first; follow links for detail.

## What this repository is

**Tenet** is a tool-neutral standard for governed, spec-driven software factories, plus the minimum tooling to adopt it: a kit of schemas, templates, reference agents and loop definitions, and a deterministic CLI (`tenet`) that never calls a model. This repository runs under the standard it defines.

It is not Tenet for Copilot (the VS Code implementation, in the `tenet-copilot` repository) and not Torus. Do not copy their product requirements here.

## Where things are

Three groups: **`kit/`** is the product content that ships and is vendored into projects; **`src/`, `test/`, `pkg/`, `docs/`, `examples/`** are the tool and its supporting files; **`tenet/`** holds this repository's own records, exactly as any project keeps them.

| Path | Level | What | You may |
|---|---|---|---|
| `tenet/vision.md` | L0 | Purpose, north star, horizons, metrics, boundaries | Read only. Only the Owner changes it |
| `tenet/specs/prd.md`, `tenet/specs/prd/catalog.md` | L1 | Kernel and product requirements; the catalog of standard claims, evidence and decisions (R-nnn) | Read; propose changes through a `spec` packet |
| `kit/TENET.md` | L1 | **The normative standard.** This project's process | Read; propose changes through a `spec` packet |
| `tenet/specs/tech-spec.md` | L2 | Architecture, formats, commands; `<!-- invariant -->` sections need the Owner | Read; propose changes through a `spec` packet |
| `tenet/specs/ux-spec.md` | L2 | CLI output, board, onboarding, wording | Read; propose changes through a `spec` packet |
| `tenet/specs/plan.md` | L2 | Milestones and packets | Read; the planner updates it through spec packets |
| `kit/` (schemas, templates, agents, loops, defaults) | Kit | Ships and is vendored, file for file, into `.tenet/kit/` of subscribing projects | Change only inside an assigned packet |
| `pkg/` | Kit | Ships in the package but is never vendored: migrations, conformance, evals, host formats | Change only inside an assigned packet; agents under test never read `pkg/evals/` |
| `tenet/packets/CP-nnnn-*/` | L3 | One folder per change | Work only in your assigned packet |
| `src/`, `test/`, `examples/` | L4 | CLI source, tests and the example project (from M1) | Change only inside your assignment's scope |
| `docs/` | — | User documentation; explains the standard, never adds rules | Change only inside an assigned packet |
| `tenet/ledger/` | — | Decisions, milestones, reviews | Append new files only; never edit one |
| `tenet/holdout/` | — | Scenarios builders never see | **Never read** in a build session |
| `tenet/now.md` | — | The factory floor | Never edit by hand once `tenet board` exists |
| `tenet/design/` | — | Parked designs; `origin/process.md` is the seed the standard grew from | Read only |

## How work flows

1. Every change is a **packet** (standard §4) in `tenet/packets/` moving through stations: intake, triage, shape, commit, design, plan, build, verify, review, validate, integrate, release, observe, close (§5).
2. A packet moves only through `tenet move` once the CLI exists (M1). Until then, the Owner moves packets by appending to `history` in `packet.yaml`. Record paths in the standard and specs (`specs/`, `packets/`, `ledger/`…) are relative to `tenet/`.
3. Gates (§6) decide moves. "Done" is computed from fresh evidence (§6.2, §6.4); never claim it.
4. Spec changes are `spec` packets (§9). Typos and broken links are clarifications with a `Tenet-Clarification:` trailer.

## Rules you must follow

- **Never** edit `tenet/vision.md`, `tenet/ledger/` files that exist, `tenet.yaml`, `kit/agents/**` outside an `agent` packet, or anything under `tenet/holdout/`.
- **Never** weaken, skip or delete a test without an approved change to the packet's acceptance basis.
- **Never** approve, review or judge your own work.
- The CLI must never call a model or make network requests except those PRD R-080 allows.
- The standard must not name a tool, model or vendor as a requirement (PRD R-003); examples and mappings are marked non-normative.
- Use plain words (UX spec §8). Refer to the Owner as "the Owner" or "Ved", with they/them pronouns.
- Commit only when asked. Commit trailers: `Tenet-Task`, `Tenet-Req`, `Tenet-Agent`, `Tenet-Run`, `Tenet-Amendment`, `Tenet-Clarification`.

## When to stop

Stop and escalate (standard §11) when tests keep failing after 3 sessions, the same failure repeats 3 times, you flip between two approaches twice, you are over appetite, or the work cannot pass without changing a test, an acceptance criterion or a higher document. Write the report from `kit/templates/escalation.md` in the packet's `escalations/` folder and set the packet to `blocked`.

## Current state

Milestone **M0 (Foundation)**: everything is a draft awaiting the Owner's approval (CP-0001). Do not start M1 packets until CP-0001 closes. See [tenet/now.md](tenet/now.md).

## Stack (from M1)

TypeScript, ESM, Node 22+, `node:test`. Runtime dependencies limited to `yaml`, `ajv`, `ajv-formats`, `commander`, `picomatch` (tech spec §1). Must run on Windows, macOS and Linux.
