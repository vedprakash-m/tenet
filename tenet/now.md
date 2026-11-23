# Now

> Generated view of the factory floor. **Written by hand at M0** until `tenet board` exists (CP-0008); from then on, never edit by hand. As of 2026-11-23 01:00.

## Waiting for you

### CP-0001 · Commit · Ratify vision v1 and approve the M0 documents · waiting 0d
Deep · serves V-P9 · needs CP-0015 (core carve-out), which needs CP-0017 (spike)
Subject: [vision.md](vision.md) v0.7 and [specs/prd.md](specs/prd.md) with its [catalog](specs/prd/catalog.md), [specs/tech-spec.md](specs/tech-spec.md), [specs/ux-spec.md](specs/ux-spec.md), [specs/plan.md](specs/plan.md) (restructured around a seven-primitive kernel: vision and PRD v0.7, tech and UX specs v0.6, plan v0.7), revised after two rounds of reviews and two comparisons with leading factories ([L-0007](ledger/L-0007-m0-documents-revised-after-four-adversarial-reviews.md), [L-0008](ledger/L-0008-m0-documents-revised-after-second-round-reviews.md), [L-0009](ledger/L-0009-factory-definition-becomes-part-of-the-standard.md), [L-0010](ledger/L-0010-specs-revised-after-comparison-with-leading-factories.md), [L-0011](ledger/L-0011-code-health-and-verification-added.md), [L-0012](ledger/L-0012-specs-restructured-around-a-seven-primitive-kernel.md)); then the kernel in [kit/TENET.md](../kit/TENET.md) once CP-0015 writes it.
Options:
  1. Stop: nothing is approved
  2. Read and correct the current documents now; ratify after CP-0017 and CP-0015 (recommended)
  3. Return specific documents to Shape with questions

## Floor

| Phase | Packet | Station | Status | Lane | Next |
|---|---|---|---|---|---|
| Define | CP-0001 Ratify vision v1 and approve the M0 documents | commit | waiting-owner | deep | the Owner |
| Define | CP-0002 Namespace check and package name | shape | active | quick | shaper |
| Define | CP-0003 Repository bootstrap | shape | blocked by CP-0001 | quick | — |
| Define | CP-0015 Carve Tenet Core out of the standard | shape | active | standard | shaper |
| Define | CP-0016 Problem validation and baselines | shape | active | standard | the Owner (interviews) |
| Define | CP-0017 Feasibility spike (runs first) | shape | active | quick | builder |

Parked until the M0 gate: release 0.1.0 packets CP-0004 … CP-0010, CP-0012 … CP-0014, CP-0018 … CP-0022, CP-0024; release 0.1.x packets CP-0011, CP-0023, CP-0025 … CP-0039.

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
