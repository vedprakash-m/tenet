# Now

> Generated view of the factory floor. **Written by hand at M0** until `tenet board` exists (CP-0008); from then on, never edit by hand. As of 2026-11-23 11:00.

## Waiting for you

### CP-0001 · Commit · Ratify vision v1 and approve the M0 documents · waiting 0d
Deep · serves V-P9 · needs CP-0015 (kernel), which needs the three spikes CP-0017, CP-0040, CP-0041
Subject: [vision.md](vision.md) and [specs/prd.md](specs/prd.md) with its [catalog](specs/prd/catalog.md), [specs/tech-spec.md](specs/tech-spec.md), [specs/ux-spec.md](specs/ux-spec.md), [specs/plan.md](specs/plan.md) (vision v0.11; PRD, catalog, tooling and decisions v0.13; tech spec v0.12 with its [contracts](specs/tech-spec/contracts.md), [algorithms](specs/tech-spec/algorithms.md), [CI](specs/tech-spec/ci.md), [agents](specs/tech-spec/agents.md) and onboarding parts; UX spec v0.13; plan v0.13 with build contracts for [alpha.0](specs/plan/alpha.0.md); scope frozen until the ready-for-pilot checklist holds), revised after seven rounds of reviews and two comparisons with leading factories ([L-0007](ledger/L-0007-m0-documents-revised-after-four-adversarial-reviews.md), [L-0008](ledger/L-0008-m0-documents-revised-after-second-round-reviews.md), [L-0009](ledger/L-0009-factory-definition-becomes-part-of-the-standard.md), [L-0010](ledger/L-0010-specs-revised-after-comparison-with-leading-factories.md), [L-0011](ledger/L-0011-code-health-and-verification-added.md), [L-0012](ledger/L-0012-specs-restructured-around-a-seven-primitive-kernel.md), [L-0013](ledger/L-0013-review-round-seven-applied-and-scope-frozen.md), [L-0014](ledger/L-0014-spec-driven-process-restored-as-the-first-value.md), [L-0015](ledger/L-0015-feasibility-review-applied.md), [L-0016](ledger/L-0016-practicality-round-applied.md) to [L-0030](ledger/L-0030-m0-spike-results.md)); then the kernel in [kit/TENET.md](../kit/TENET.md) once CP-0015 writes it.
Options:
  1. Stop: nothing is approved
  2. Read and correct the current documents now; ratify after the spikes and CP-0015 (recommended)
  3. Return specific documents to Shape with questions

## Floor

| Phase | Packet | Station | Status | Lane | Next |
|---|---|---|---|---|---|
| Define | CP-0001 Ratify vision v1 and approve the M0 documents | commit | waiting-owner | deep | the Owner |
| Define | CP-0002 Namespace and licence (before bootstrap) | shape | active | quick | the Owner |
| Define | CP-0003 Repository bootstrap | shape | blocked by CP-0001 | quick | — |
| Define | CP-0015 Kernel and contract freeze (then the medium-model trial) | shape | active | careful | shaper |
| Define | CP-0016 Problem validation and baselines | shape | active | careful | the Owner (interviews) |
| Define | CP-0058 Medium-model trial (after CP-0015) | shape | parked | quick | the Owner |
| Define | CP-0017 Spike A: identity and decisions (runs first) | shape | active | quick | builder |
| Define | CP-0040 Spike B: signed evidence and two-job CI (runs first) | shape | active | quick | builder |
| Define | CP-0041 Spike C: events, replay and performance (runs first) | shape | active | quick | builder |

Parked until the M0 gate, in [wave order](specs/plan.md#2-waves): release 0.1.0-alpha.0 (intent and proof) CP-0004, CP-0005, CP-0012, CP-0006, CP-0018, CP-0044, CP-0009, CP-0045, CP-0053, CP-0048, CP-0051, CP-0054, CP-0010, CP-0052, CP-0057; alpha.1 (protect) CP-0049, CP-0007, CP-0050, CP-0019, CP-0008; alpha.2 (verify) CP-0042, CP-0046, CP-0021; 0.1.0 CP-0022, CP-0056, CP-0020, CP-0055, CP-0013, CP-0014, CP-0024; 0.1.x CP-0011, CP-0023, CP-0025 … CP-0039, CP-0043, CP-0047.

## Vision scorecard

| Horizon | Status |
|---|---|
| V-H1 A verified slice | Not started (measured on 0.1.x) |
| V-H2 Enforced end to end | Not started (M2–M3) |
| V-H3 Self-updating and interoperable | Not started (M4, 1.0) |
| V-H4 Managed workforce | Not started (M5) |
| V-H5 Ecosystem | Not started |

Metrics V-M1 – V-M10: not measured yet. Baselines for V-M1, V-M3 and V-M4 come from CP-0016.

## Escalations

None.

## Flow

Not measured yet.

## Recently closed

None.

## Ledger index

| ID | Kind | Title |
|---|---|---|
| [L-0030](ledger/L-0030-m0-spike-results.md) | review | M0 spike results: what worked, what needs the Owner, what changed |
| [L-0029](ledger/L-0029-two-tracks-no-calendar-waits.md) | decision | Two tracks, no calendar waits |
| [L-0028](ledger/L-0028-working-practices-ship-with-tenet.md) | decision | Working practices ship with Tenet |
| [L-0027](ledger/L-0027-last-pass-before-build.md) | decision | Last pass before build: tests matched to declarations, CI that works, fail-closed outcomes |
| [L-0026](ledger/L-0026-a-minimal-reference-runner.md) | decision | A minimal reference runner ships in 0.1.0 |
| [L-0025](ledger/L-0025-careful-lane-staffed-and-loops-specified.md) | decision | The careful lane is staffed in 0.1.0, and loops have an exact contract |
| [L-0024](ledger/L-0024-one-ci-shape-and-intent-on-the-card.md) | decision | One CI shape, intent on the card, and honest result classes |
| [L-0023](ledger/L-0023-contracts-frozen-before-build.md) | decision | Contracts frozen before build; blessed intent survives drift |
| [L-0022](ledger/L-0022-onboarding-specified-end-to-end.md) | decision | Onboarding specified end to end; releases promise only what they ship |
| [L-0021](ledger/L-0021-positioned-as-a-ready-to-use-system.md) | decision | Tenet is positioned as a ready-to-use system built on a standard |
| [L-0020](ledger/L-0020-github-home.md) | decision | Tenet's home is github.com/vedprakash-m/tenet |
| [L-0019](ledger/L-0019-getting-tenet-takes-one-step.md) | decision | Getting Tenet takes one step, from the GitHub page |
| [L-0018](ledger/L-0018-two-starting-paths.md) | decision | The experience starts from two explicit paths: an existing repository and a new project |
| [L-0017](ledger/L-0017-ux-spec-rewritten-as-a-journey.md) | decision | The UX specification is rewritten as a step-by-step journey, with a 0.1.0 upgrade path |
| [L-0016](ledger/L-0016-practicality-round-applied.md) | decision | Practicality round applied: one adoption level, intent and proof first, no bookkeeping for people |
| [L-0015](ledger/L-0015-feasibility-review-applied.md) | decision | Feasibility review applied: signed evidence, a declared fourth assumption, receipts before the kernel, less ceremony |
| [L-0014](ledger/L-0014-spec-driven-process-restored-as-the-first-value.md) | pivot | The spec-driven process is restored as Tenet's first value |
| [L-0013](ledger/L-0013-review-round-seven-applied-and-scope-frozen.md) | decision | Review round seven applied: the gate rule made precise, a fourth trust assumption, and scope frozen |
| [L-0012](ledger/L-0012-specs-restructured-around-a-seven-primitive-kernel.md) | decision | Specs restructured around a seven-primitive kernel and one gate rule |
| [L-0011](ledger/L-0011-code-health-and-verification-added.md) | decision | Code health and verification added: continuing obligations, health ratchet, method list, proof evidence |
| [L-0010](ledger/L-0010-specs-revised-after-comparison-with-leading-factories.md) | decision | Specs revised after comparison with leading organizations' factories: proof table, decision-time snapshots, campaigns, readiness |
| [L-0009](ledger/L-0009-factory-definition-becomes-part-of-the-standard.md) | decision | The factory definition becomes part of the standard; Tenet declares and governs it, platforms run it |
| [L-0008](ledger/L-0008-m0-documents-revised-after-second-round-reviews.md) | decision | M0 documents revised after the second round of reviews: rules from the target, evidence off-branch, signed content, a thinner 0.1.0 |
| [L-0007](ledger/L-0007-m0-documents-revised-after-four-adversarial-reviews.md) | decision | M0 documents revised after four adversarial reviews: a small core, a verified slice first |
| [L-0006](ledger/L-0006-records-folder-renamed-tenet.md) | decision | The default records folder is tenet/, not factory/ |
| [L-0005](ledger/L-0005-repository-split-into-kit-pkg-and-factory.md) | decision | Repository split into kit, pkg and factory; projects get three root files and two folders |
| [L-0004](ledger/L-0004-m0-started-standard-0.1.0-draft-derived-from.md) | milestone | M0 started: standard 0.1.0-draft derived from the Torus process document |
| [L-0003](ledger/L-0003-loops-are-engine-neutral-definitions-compiled-to.md) | decision | Loops are engine-neutral definitions compiled to engines; Conductor first |
| [L-0002](ledger/L-0002-one-npm-package-holds-the-kit.md) | decision | One npm package holds the kit and a deterministic CLI |
| [L-0001](ledger/L-0001-tenet-names-the-standard-the-vs.md) | decision | Tenet names the standard; the VS Code implementation becomes Tenet for Copilot |
