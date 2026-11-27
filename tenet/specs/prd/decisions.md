---
tenet: {spec: 1, doc: prd, level: L1, version: "0.13", owner: ved}
sections:
  _preamble: {state: draft, digest: sha256:6b13fd2bbf7c7e4a7ffc8f4acf83e3c87eecf2bf2d7a4477bf39dfbf2e050bbe, flags: []}
  7-decisions: {state: draft, digest: sha256:8848f2637c582edb07699e001f8d9fa02e3eae0e15be3d8ab46361dca9f32666, flags: []}
  8-risks: {state: draft, digest: sha256:175d1fd10922a2891791ced71b6c1c6b3699119b23055bd6e3e244649cf7fab7, flags: []}
  9-open-questions: {state: draft, digest: sha256:83c1b8aec8f3f7a360ed5da7633a13c992c0c364def54fab71c09a52dc43f595, flags: []}
---
# Tenet requirements: decisions, risks and open questions

> Level L1 · Version 0.13 · Part of [prd.md](../prd.md) · Status: **draft, awaiting the Owner's approval** · Budget: 7,000 tokens · Split from `prd.md` §7–§9 under the rollover rule (L-0024)

**Context card.** The product decisions behind the requirements, each with its ledger entry; the risks and their mitigations; and the questions still open. Section numbers are kept from `prd.md`.

## 7. Decisions

| Decision ID | Decision | Ledger |
|---|---|---|
| DEC-01 | Tenet is the standard; the VS Code implementation is Tenet for Copilot | L-0001 |
| DEC-02–04 | One package holds kit, CLI and SDK; the kit is pinned by a lock (vendored only on request, DEC-41); overlays only narrow | L-0002, L-0005 |
| DEC-05 | Loops are an engine-neutral format | L-0003 |
| DEC-06–09 | No model calls; TypeScript on Node 22; self-hosting; a small core plus packs | L-0004 |
| DEC-10–14 | Replayed events; two-job verifier; off-branch evidence; content-signed decisions; ULID aliases; declared strengths | L-0007, L-0008 |
| DEC-15–20 | `minimal` default; open formats; rules from the target; a layer beside other tools (DEC-18, amended by DEC-39); GitHub first; release gates apart from horizons | L-0007, L-0008 |
| DEC-21–22 | The factory definition is part of the standard and never executed by Tenet; factory changes are packets with a stated purpose | L-0009 |
| DEC-23–27 | `forge-verified` default; two configuration planes; campaign approval; approvals by risk; judging and platforms stay outside | L-0010 |
| DEC-28–31 | Continuing promises; health ratchet on touched scope; one method list; staged self-verification | L-0011 |
| DEC-32 | **Seven primitives and one gate rule**; every feature is a catalog entry | L-0012 |
| DEC-33 | "Claim" means something that must hold; exclusive work locks are **leases** | L-0012 |
| DEC-34 | Gate rule counts `approve`; selectors with tighten-only merge; two strength axes (provenance, independence) plus admissible methods (L-0023); limited waivers | L-0013 |
| DEC-35 | `forge-verified` means attributable to an account; trust assumption 4 is declared and spot-checked | L-0013 |
| DEC-36 | `minimal` is pull-request native, one human touch in the careful lane | L-0013 |
| DEC-37 | Continuing promises move to 0.1.x with defeaters and the ratchet | L-0013 |
| DEC-39 | **Spec-driven first**: the spec process is the first value; evidence enforces it; spec tools feed the ladder | L-0014 |
| DEC-40 | **One adoption setting**, `observe` by default; rules promoted on evidence; keys and twice-ratified visions at `assure` | L-0016 |
| DEC-41 | First release is **intent and proof**; signing arrives with `verify`; the kit is not vendored | L-0016 |
| DEC-42 | **People do no bookkeeping**: no commit trailers, no packet folder for quick changes, spec deltas ride with code, decisions use native reviews | L-0016 |
| DEC-43 | A **ready-to-use system built on a standard**, usable as-is with any agent, model and pull-request engine | L-0021 |
| DEC-44 | **Onboarding end to end**: inventory, cited drafts of five views, conflicts listed, blessing only by a person, drafts as hints | L-0022 |
| DEC-45 | Releases promise only what they ship; the verify release is `0.1.0-alpha.2`; the npm package is `@vedprakash-m/tenet` | L-0022 |
| DEC-46 | **Contracts before build**: formats and algorithms are frozen in tech-spec parts, and each packet has a build contract, before its build starts | L-0023 |
| DEC-47 | **Blessed intent survives drift**: the last blessed text stays in force; changes and changed sources raise flags, never remove authority | L-0023 |
| DEC-48 | **One CI shape from the first release**: a test job that holds no write token and a recorder that never runs the change; `verify` adds signing and a sealed test job | L-0024 |
| DEC-49 | **Four result classes** (checked by Tenet, for you to judge, depends on your agent or host, not done by Tenet); `protect` blocks honest mistakes and is labelled detected | L-0024 |
| DEC-50 | **Intent leads the card**: acceptance items are numbered within their pull request, requirement tags give lasting traceability, and the card opens with the blessed requirements a change touches | L-0024 |
| DEC-51 | **The careful lane is staffed in 0.1.0** (shaper and test writer join builder and judge), and loops have an exact contract | L-0025 |
| DEC-52 | **A minimal reference runner ships in 0.1.0** as a separate, optional package: an executor only (evidence still comes from CI), driving the user's own agent host through the adapter contract external factories also use; the core CLI still never calls a model and Tenet still never executes a factory definition itself | L-0026 |
| DEC-53 | **Fail closed means `failure`**: at `verify` a required control that cannot run concludes `failure` on the forge, never `neutral`; one outcome table decides every case | L-0027 |
| DEC-54 | **A test result belongs to its declaration**: cases match tagged declarations by name; where a runner cannot support that, the card says coverage is not confirmed | L-0027 |
| DEC-55 | **Blessings have their own protection tier**: blessed text and blessing fields change only with the section owner's blessing, never through `change-policy` | L-0027 |
| DEC-56 | **Working practices ship with Tenet**: default working rules in the agent block, existing instruction files imported as drafts, and the checkable practices queued as ideas | L-0028 |
| DEC-57 | **Two tracks, no calendar waits**: building is gated only by automatic checks and backtests; evidence of use gates announcements and horizon claims; every contract is written in M0 | L-0029 |
| DEC-58 | **Licences and schema host**: Apache-2.0 for code, CC BY 4.0 for text; schema IDs under `https://vedprakash-m.github.io/tenet/schemas/<version>/` | L-0031 |
| DEC-38 | Scope is frozen until the ready-for-pilot checklist holds; new ideas enter the catalog as `idea` | L-0013 |

## 8. Risks

| Risk ID | Risk | Mitigation |
|---|---|---|
| RK-01 | The standard grows too large | Seven primitives; kernel budget of 8,000 tokens; scope freeze; new ideas are catalog `idea` entries |
| RK-02 | Hosts and forges change faster than bindings and runner adapters | Bindings and adapters versioned apart; a capability table per adapter; stale ones marked unsupported; a generic command adapter always works |
| RK-03 | Auto-merged updates break a project | Structured classification; review below 1.0 |
| RK-04 | The name is taken | CP-0002 |
| RK-05 | People assume stronger guarantees than they have | Guarantee levels, observed trust assumptions, `doctor` |
| RK-06 | One steward | Time-boxed packets; ledger; open proposal process before 1.0 |
| RK-07 | Setup or defaults punish honest users | `observe` default; no hardware, bot or paid plan until `verify`; friction budget (R-216); rules promoted on evidence |
| RK-08 | LLM critics are biased | Checks first; activation test; incomplete reviews never converge |
| RK-09 | The problem is not the one adopters feel | Reconstruction exercise; external pilot before V-H1 |
| RK-10 | The trust model depends on forge features | Observed and shown; one forge first |
| RK-11 | Presence may not be provable from signatures | CP-0017 tests it |
| RK-12 | Declaring the factory, or shipping a runner, pulls Tenet toward being a platform | Tenet validates, records and governs; the reference runner stays minimal (one repository, no scheduler, dashboard or fleet), optional and separate, and uses the same adapter contract as external factories |
| RK-13 | Factory platforms see no reason to conform | The Warp mapping (R-131) shows which advisory gates become enforced |
| RK-14 | The kernel is too abstract for users | Users see claim types by their own names (acceptance item, promise, health indicator); the generic words appear only in the kernel |
| RK-15 | Agents act through a decision-maker's forge session | Fourth trust assumption declared and spot-checked; bot identities from `verify`; red-team case; `person-present` at `assure` |
| RK-16 | Specs grow without feedback from use | Ready-for-pilot checklist; spikes first; review running software |
| RK-17 | Trust mechanics crowd out the spec process again | The spec process is §4.0 and Part I's first section; it ships first; every review checks it |
| RK-19 | Results read as stronger than they are | Four result classes on every surface; "test passed" never "proven"; `protect` labelled detected |
| RK-18 | Drafted specifications sound right but are wrong | Origin and citations checked by `tenet check`; asked statements never inferred; conflicts listed; blessing by a person; onboarding evaluation suite and V-M12 |


## 9. Open questions

| Question ID | Question | Needed by |
|---|---|---|
| OQ-01 | Package name: settled as `@vedprakash-m/tenet` (L-0022); revisit only if the plain name becomes available | — |
| OQ-02 | Which issue sources `tenet import` reads first | 0.1.x |
| OQ-03 | Whether the conformance kit is also a separate package | M4 |
| OQ-04 | Closed in L-0031: Apache-2.0 for code, CC BY 4.0 for the standard's and documents' text | — |
| OQ-05 | Which external project pilots 0.1.x | 0.1.x |
| OQ-07 | Which engines get the first adapters | M3 |

OQ-06 and OQ-08 were closed in L-0010.
