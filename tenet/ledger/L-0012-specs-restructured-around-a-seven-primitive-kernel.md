---
id: L-0012
kind: decision
date: 2026-11-23
packet: CP-0001
title: "Specs restructured around a seven-primitive kernel and one gate rule"
---
# L-0012 · Specs restructured around a seven-primitive kernel and one gate rule

## Context

After six rounds of review the specifications had grown by accretion: about 35,600 tokens across six documents, 140 requirements (79 touching 0.1.0), 23 event types, about 14 decision kinds and some fifteen separate vocabularies. Each fix had been added as a new noun. A complexity review found that nearly every concept was an instance of a few ideas: something that must hold, an observation that it does, an authorized choice, and rules about which of those apply where.

## Decision or event

The Owner approved restructuring around a kernel:

1. **Seven primitives** (Subject, Actor, Claim, Evidence, Decision, Event, Policy) and **one gate rule**: a transition is allowed when every applicable claim is satisfied by fresh evidence at the required strength, or waived by a fresh decision at the required strength (DEC-32, R-200 to R-204).
2. Every feature becomes a **standard type** in a new catalog (`specs/prd/catalog.md`): acceptance items, continuing promises, protected paths, health indicators and readiness are claims; receipts, reviews, proofs and observations are evidence; approvals, quarantines, overrides, health-regression acceptances and conflict resolutions are five decision kinds (`approve`, `waive`, `choose`, `delegate`, `resolve`). Requirement IDs are kept; none is lost or reused.
3. Event types reduce to about eight; work locks are renamed **leases** so "claim" has one meaning (DEC-33).
4. The vision's seventeen principles merge into ten; retired IDs are listed in the vision and remapped in packets.
5. The kernel (Part I of the standard) has a budget of 8,000 tokens; the PRD 9,000; the tech spec 12,000; the UX spec 6,000.
6. Previous versions are archived unchanged under `tenet/archive/` per the rollover rule; `prd/factory-and-fleet.md` is replaced by the catalog.

0.1.0 is now defined as the kernel plus the `minimal` pack's standard claims, the two-job verifier, forge-verified decisions, the board and the red-team suite.

## Evidence

The complexity assessment of 2026-11-23: about 30 nouns and 15 vocabularies reduce to seven primitives; the PRD and its split part fall from about 14,300 to about 10,300 tokens; the tech spec from about 10,500 to about 8,000.

## Consequences

CP-0015 writes Part I as the kernel and Part II as the catalog's standard types. CP-0004, CP-0006 and CP-0007 are re-scoped to the primitives, policy and gate rule. Ledger entries L-0005 to L-0011 remain as history; where they name `factory-and-fleet.md` or old decision names, the catalog is the current home.
