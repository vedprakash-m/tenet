---
id: L-0026
kind: decision
date: 2026-11-23
packet: CP-0001
title: "A minimal reference runner ships in 0.1.0"
---
# L-0026 · A minimal reference runner ships in 0.1.0

## Context

Tenet already planned to ship agents: the cards, their skills and the loops that chain them. It did not plan to ship anything that **starts** them in order. Until engine adapters arrived at M3, the careful lane needed a person or an outside factory to hand each step to the next. That broke the "works out of the box" promise (DEC-43, V-V3, V-B10). The Owner asked whether Tenet should ship a minimal software factory that works on its own while staying open to the prominent ones.

## Decision or event

The Owner approved a **minimal reference runner in 0.1.0** (DEC-52, R-224, D9):
- **Package:** separate and optional, `@vedprakash-m/tenet-runner`, at the same version as Tenet. The core CLI still never calls a model, and Tenet still never executes a factory definition.
- **What it runs:** the user's own agent host, through adapters implementing the 0.1.0 slice of the engine adapter contract (R-041: start, status, cancel, usage, result). The same contract serves external factories.
- **What it does:**
  - reads the next action and takes a lease
  - works each item in its own worktree, assigning and returning results through `tenet assign` and `tenet result`
  - opens the pull request with the user's forge tool
  - stops at every human gate and stop threshold
- **Executor only:** evidence still comes from CI alone.
- **Minimal by design:** one repository; no scheduler, daemon, dashboard or fleet; at most `--parallel` items.
- **Adapters in 0.1.0:** a generic `command` adapter plus two host adapters chosen by a new spike.

**Plan:**
- two splits from CP-0020: **CP-0056** (Spike D: headless agent hosts, 2 days, alongside CP-0022) and **CP-0055** (the reference runner)
- the GA order becomes CP-0022 and CP-0056 → CP-0020 → CP-0055 → CP-0013 and CP-0014 → CP-0024
- the quick start and Torus dogfooding run careful changes through the runner
- the 0.1.0 gate adds "the runner takes a careful change to a pull request, stopping only for the Owner's approval, with two host adapters"

## Evidence

The lifecycle walkthrough and the Owner's question in the session of 2026-11-23.

## Consequences

- **Unchanged:** the vision. V-P4 holds because the runner is one optional orchestrator among many; V-B4 holds because the runner calls the user's agent tool, not a model, and is not enforcement tooling.
- **PRD:** a scope row, D9, R-224, R-041 and R-043 now with 0.1.0 slices, DEC-52, and wider RK-02 and RK-12 mitigations.
- **Tech spec:** `agents.md` §6 (adapters and runner), a bindings row, the repository layout and a commands row.
- **UX spec and README:** the careful lane runs through `tenet-runner start`, and a "run headless" row is added.
- **Ongoing cost:** host command-line tools change often, so adapters need maintenance; the `command` adapter always works as a fallback.
