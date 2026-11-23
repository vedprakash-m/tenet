---
id: L-0015
kind: decision
date: 2026-11-23
packet: CP-0001
title: "Feasibility review applied: signed evidence, a declared fourth assumption, receipts before the kernel, less ceremony"
---
# L-0015 · Feasibility review applied: signed evidence, a declared fourth assumption, receipts before the kernel, less ceremony

## Context

A feasibility review of v0.8 found the kernel buildable, but: value arrived only after about twelve packets; the most likely first adopter (one maintainer, a private repository, a local agent using their own forge session) would see almost every guarantee fall to *detected*; a write-protected custom ref for evidence is probably not available on GitHub, whose rulesets cover branches and tags; trust assumption 4 can only be spot-checked; and a quick change took about eight agent actions. The spec-kit restoration (L-0014) had since made the spec process the first release; the review's remaining recommendations still applied.

## Decision or event

1. **Signed evidence.** The attest job signs each record with its workflow identity (on GitHub, an OIDC token whose audience is the record's digest). Trust assumption 2 becomes "evidence carries proof that the protected job produced it"; a store only that job can write is the fallback (R-100, tech spec §7.3). R-080 allows fetching the forge's signing keys when the user asks.
2. **Assumption 4 is declared, not observed.** It is spot-checked and supports enforced* only where a host binding attests that agents run without decision-makers' credentials (R-110, R-101).
3. **Hardened reference workflow**, with red-team cases for cache poisoning and artifact injection (R-100, R-106).
4. **Less ceremony.** In pull-request native mode moves are derived from forge state recorded by the attest job (R-186); review approval is the primary decision path, with copy-ready comment lines; `init` writes at most 15 lines, reading CODEOWNERS and existing scripts (R-020, R-144).
5. **The Owner approves acceptance items, not tests.** Distinguishing evidence is required for every behavior-changing item in every lane (R-111, R-172).
6. **Release slicing.** After the spec kit, **0.1.0-alpha.1 acceptance receipts** (CP-0018) posts which acceptance items are proven on the exact commit, with exit measures: Owner minutes per agent pull request, false "done" claims caught, record overhead under 2 minutes, setup under 1 hour.
7. **Spikes** run on the first adopter's real setup (CP-0017) and test signed evidence first (CP-0040). The plan states when to stop or change course, and this repository keeps its own process light until the spec kit.
8. Lane mix is shown against a target (default ≥70% quick or express). Native provenance import is a parked idea (R-198).

## Evidence

The feasibility review of 2026-11-23; GitHub documentation on rulesets (branches and tags; private repositories need a paid plan) and on OIDC token claims (a custom audience is supported).

## Consequences

Order of releases: spec kit, acceptance receipts, then the internal alpha with events, decisions and the board. The trust spine no longer depends on a protected custom ref.
