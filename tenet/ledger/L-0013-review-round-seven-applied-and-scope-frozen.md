---
id: L-0013
kind: decision
date: 2026-11-23
packet: CP-0001
title: "Review round seven applied: the gate rule made precise, a fourth trust assumption, and scope frozen"
---
# L-0013 · Review round seven applied: the gate rule made precise, a fourth trust assumption, and scope frozen

## Context

The seventh review round (three independent reviews of the v0.7 kernel) agreed that the kernel is the right foundation, that the hard problems had moved into the gate rule's details, that forge-verified decisions could be made by an agent holding the Owner's session, and that 0.1.0 and several packets were still too large. All three said further paper review had diminishing returns.

## Decision or event

The Owner approved the synthesis and asked for the good recommendations to be applied with the least added complexity:

1. **Gate rule** counts a fresh `approve` for approval claims; claims carry a selector; policies only tighten; unknown applicability refuses; gate events record the argument (DEC-34, R-200, R-202).
2. **Strength** has three ordered axes (provenance, independence, method accepted per claim class); methods are never ranked globally (R-034, R-174).
3. **Waivers** need scope, reason and expiry; the actor who broke a claim cannot waive it; some claims are unwaivable; retiring a promise is an `approve` (R-203, R-103).
4. **A fourth trust assumption**: agents never hold decision-makers' forge credentials or keys. `forge-verified` means attributable to an account, counts as enforced* only while that is observed, and comments name the subject digest (DEC-35, R-101, R-110).
5. **Pull-request native** `minimal` pack with one human touch in the standard lane; `tenet new` prints the pull-request command and makes no network call (DEC-36, R-186).
6. **Agents are subjects** whose qualification is a continuing claim on their tuple (R-206); minimal valid records (R-205); stable case IDs (R-188); defeaters (R-187).
7. **Release slicing**: 0.1.0-alpha inside this repository first; continuing promises move to 0.1.x with the health ratchet; proof, simulation and differential schemas to M2 (DEC-37).
8. **Plan**: three time-boxed spikes (CP-0017, CP-0040, CP-0041); CP-0018 split (CP-0042); CP-0043 for promises; invariant markers become provisional until confirmed.
9. **Scope freeze** until the ready-for-pilot checklist holds; parked ideas are catalog `idea` rows R-190 to R-197 (DEC-38).

Rejected: a claim-composition algebra beyond any-of methods and all-of claims, oracle and assurance-dimension ladders, a YAML requirement registry, domain profiles and adapter conformance before M2.

## Evidence

Reviews of 2026-11-23 and their synthesis; each factual claim in them was checked against the files before adoption.

## Consequences

Vision v0.8, PRD and catalog v0.8, tech spec v0.7, UX spec v0.7, plan v0.8; previous versions archived. `kit/TENET.md` carries a banner saying the specs take precedence until CP-0015.
