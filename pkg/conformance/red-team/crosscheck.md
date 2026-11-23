# Red-team coverage and guarantee cross-check

Compare [R-106](../../../tenet/specs/prd/tooling.md), [technical specification §14](../../../tenet/specs/tech-spec.md#14-security) and [CI §7](../../../tenet/specs/tech-spec/ci.md#7-trust-observations-and-guarantee-levels). The [catalog](catalog.yaml) describes fixture outlines. It is a coverage map before implementation. A row's release and conditions govern when the case is eligible. A scenario description alone supplies no evidence that the binding enforced its control.

| Technical specification §14 or R-106 control | CI §7 comparison | Catalog |
|---|---|---|
| Target policy and protected changes | Mode B reports detection below verify. Current trust and required status are separate prerequisites for enforcing merges. Local Mode A enforcement applies only to advances that engine controls. Blessing records carry their own authorization. | RT-001–003 |
| Forged, stolen or substituted evidence | T2 identifies the protected recorder. The selected receipt also needs the matching subject, work, inputs and evaluation. Producer separation does not establish a test's truth or suitability. | RT-004–006, RT-025 |
| Test job credentials and recorder inputs | CI §5 establishes the trust boundary. Its network, secret and cache properties need real capability evidence. Section 7's provenance row alone covers neither containment nor the semantic content of an artifact. | RT-007–009 |
| Reserved decisions | Proof-table strength applies. Account attribution and eligibility are distinct from person presence. T4 needs host attestation for enforcement. A channel-only answer remains advisory even when the policy requires a stronger answer. | RT-010–015 |
| Hand-written or conflicting moves | Mode A checks its own transitions. Mode B detects local moves and enforces conditionally through replay and required status. | RT-016–017 |
| Squash merges | The mechanics preserve reference and attribution facts at their available strength. CI §7 provides no universal squash-merge guarantee. | RT-018 |
| Holdout | In-repo holdout is advisory. External holdout can justify enforced* when the build environment prevents access. Merely naming an external location cannot demonstrate isolation. | RT-019 |
| Prompt injection and malicious skills | Host and adapter capabilities set containment strength. Pins detect changed skill bytes. A valid digest cannot establish that a skill is benign. | RT-020, RT-031 |
| Checks skipped, removed, special-cased or affected by test hooks | Protected changes can be enforced conditionally. An untrusted test result can be misleading even from the correct job. Report deltas and case discovery use the applicable mode and observed limits. | RT-021–026 |
| Distinguishing baseline | A harness error is inconclusive. The CI trust table addresses provenance, with no claim about the baseline reaching the intended failure. | RT-027 |
| Continuing claims and quarantine | Point-release controls have no current enforcement until shipped and observed. Replay and the required status remain relevant where these claims gate work. | RT-028–029 |
| Proof audit | M2 subject, theorem and auditor assumptions still apply. The CI §7 signature claim establishes receipt origin and has narrower scope than proof correctness. | RT-030 |

## Mismatches resolved in this track

- The main technical specification now points to the catalog and distinguishes the Mode B advisory and detection levels below verify from conditional enforcement. It separates observed trust from the requirement for a passing merge status.
- Section 14 now requires demonstrated access isolation for external holdouts and states the limit of a check job's report. The catalog reflects the separate blessing tier under R-103 and R-223.

## Proposals for the coordinator

1. **CI §7, holdout row.** Replace “enforced* if external” with “enforced* when the binding demonstrably prevents builder access to an external holdout.” Keep in-repo holdout advisory.
2. **CI §7, evidence independence row.** State separately whether the recorder is attributable to a protected verifier and whether the method was written or controlled independently of the claimant. Apply the two axes in technical specification §3.1.
3. **CI §7, decision row.** Clarify that the presence of a forge session or key does not establish separation. Attribute the observation at the proof-table strength and reduce enforcement when T4 is unavailable.
4. **CP-0021 proving.** Treat RT IDs as stable coverage IDs. Use separate statuses for simulated result, live observation, planned in a later packet, and unsupported on the binding. Use the original recorded approval and withdrawal capability when scoring RT-015. Do not award the later withdrawal guarantee on the earlier edited-approval fixture.
5. **Release evidence and unassigned cases.** Keep hardware-backed presence, forks, required checks and the sealed job as outstanding live tests where L-0030 leaves them unobserved. Assign the M2 proof-audit case to its actual proving packet when scheduled. CP-0021 records the coverage obligation before that packet exists.
6. **Acceptance rule name.** Apply L-0032's `acceptance-passed` spelling throughout the binding contracts and current implementation tracks. Historical archive copies retain their original bytes.
