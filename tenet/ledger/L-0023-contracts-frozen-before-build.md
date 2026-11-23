---
id: L-0023
kind: decision
date: 2026-11-23
packet: CP-0001
title: "Contracts frozen before build; blessed intent survives drift"
---
# L-0023 · Contracts frozen before build; blessed intent survives drift

## Context

A review round (four reviews) asked whether a medium-effort model could build Tenet from the specifications without making design choices. All four found the vision coherent. All four found the specifications not yet buildable:
- Formats, grammars and algorithms were written as prose.
- Release boundaries contradicted each other: alpha.0 and alpha.1 features relied on the attest job and evidence store, which arrive in alpha.2.
- The kit schemas encoded a superseded model.
- The plan was a milestone map: definitions were stubs, 46 of 48 packets had `blocked_by: []`, several packets were too large, and alpha.2's order was reversed.

The most important finding: a blessed requirement went `stale` when its cited code changed, and stale sections dropped out of agent context exactly when drift happened.

## Decision or event

The Owner approved the synthesis and its four recommendations:
1. The level × rule table as proposed.
2. alpha.0 runs tests itself in the proof job and never edits `package.json`.
3. Build contracts live in plan parts by release.
4. Full contracts now for M0 and alpha.0 only.

**Fourteen decisions settled** (DEC-46, DEC-47):
- **D1 Blessed intent survives drift.** The last blessed text stays in force. `edited` (text changed since blessing, an unblessed proposal) and `sources-changed` (cited code changed, review requested) replace `stale`. Context returns the blessed copy with its flags.
- **D2 Blessing proof by release:** `recorded: self` (alpha.0), `forge` (alpha.1), `signed` (alpha.2). Every owner of a changed section is needed.
- **D3** The first onboarding card is rendered locally into the pull request description; CI cards start after the setup merges.
- **D4** The subject digest covers code only; check inputs live on the evidence.
- **D5** `prev` is an array; gate events record `evaluated_at`.
- **D6** The gate is a decision table with reason codes and a separate disposition (ALG-07).
- **D7** A proof job and an unsigned records ref serve alpha.0 and alpha.1; the attest job and evidence store take over at alpha.2. A quick change is the work item `pr-<number>`.
- **D8** Reporter flags go in `tenet.yaml`; reusing another workflow's reports moves to 0.1.x.
- **D9** IDs: `R-<n>` assigned by `tenet fix`, acceptance items `AB-<pr>-<n>`, one tag grammar.
- **D10** Strength has two ordered axes plus method admissibility.
- **D11** `verify` fails closed; an override is a waiver labelled `accepted-without-verification`.
- **D12** Lanes are express, quick, careful and deep; `explore` is a work type; "standard" is gone.
- **D13** One level × rule table with alpha.0 rules capped at `advise`.
- **D14** `fast-xml-parser` becomes the sixth runtime dependency.

**New parts:**
- `tech-spec/contracts.md`: identifiers, the acceptance block, front matter and requirement lines, onboarding files, card and board models, test reports, CI by release, the command matrix, MCP, the install manifest, determinism, evidence payloads.
- `tech-spec/algorithms.md`: ALG-01 to ALG-13 with error codes and fixtures.
- `plan/alpha.0.md` (full contracts), `plan/alpha.1.md`, `plan/alpha.2.md`, `plan/0.1.0.md` (needs, owns, proving).

**Plan:**
- Waves (plan §2), with `blocked_by` in every `packet.yaml` as the authoritative copy.
- Five splits:
  - CP-0004 → CP-0049 (kernel schemas)
  - CP-0007 → CP-0050 (gate, rule modes, `level` and `rules`)
  - CP-0018 → CP-0051 (proof job, card, records ref)
  - CP-0048 → CP-0052 (blessing, onboarding card, evaluation)
  - CP-0008 → CP-0053 (alpha.0 specification board)
- The eight-field build contract.
- alpha.2 reordered CP-0042 → CP-0046 → CP-0021.
- The 10-minute reply window removed from CP-0017 and CP-0019; replies bind to the commit the latest card showed.
- The ready-for-pilot checklist gains the contract freeze, the **medium-model trial** (CP-0044 built from its contract alone until nothing is invented) and the dependency check.

**Also fixed:** package `exports` target `./dist/sdk.js`; error output follows R-083; `kit_path` is null unless self-hosting; pinned installs (`npx tenet` for dev dependencies); `tenet remove` reminds rather than detects; CODEOWNERS matching follows GitHub's last-matching-line rule; `verify --proof` added to the command matrix; `level` and `rules` move to alpha.1; the packet schema's lane enum updated.

## Evidence

The four reviews and the synthesis in the session of 2026-11-23. The reviewers' factual claims were checked against the repository before the synthesis.

## Consequences

- Vision v0.11 changes only V-M12's measures (kept and recalled, invented, minutes) and the amendment log; purpose, principles, horizons and boundaries are unchanged.
- PRD, catalog and tooling v0.11; tech spec v0.10 with two new parts; UX spec v0.11; plan v0.11 with four new parts.
- Five new packets (CP-0049 to CP-0053); every packet records its dependencies; lane `standard` becomes `careful`.
- Build of alpha.0 starts only after the contracts are frozen and the medium-model trial invents nothing.
