# CP-0015 Part I cross-check

Sources were checked again after merging main at `dcb95bb`, including L-0023 through L-0031, plan v0.14, and the current CI, agents and evidence parts. Unqualified sections are from the main technical specification. A dash means the source gives a rule in prose without a numbered algorithm.

| Part I rule | PRD requirement | Technical specification | Algorithm |
|---|---|---|---|
| TN-K-001 | R-207, R-011 | §6.3 | ALG-02 |
| TN-K-002 | R-208, R-209 | §6.3 | ALG-03 |
| TN-K-003 | R-208, R-209 | §6.3 | ALG-03, ALG-07 |
| TN-K-004 | R-208, R-209, R-220 | §6.3, 8 | ALG-14 |
| TN-K-005 | R-210, R-027 | §6.3, onboarding §1, contracts §3 | ALG-02, ALG-04 |
| TN-K-006 | R-210, R-033 | §6.3, contracts §§1–3 | ALG-04, ALG-08 |
| TN-K-007 | R-207, R-211, R-223 | §6.3, onboarding §1 | ALG-03, ALG-11, ALG-13 |
| TN-K-008 | R-211, R-223 | §6.3, onboarding §1 | ALG-03, ALG-10 |
| TN-K-009 | R-008, R-033, R-220 | §6.3, 9 | ALG-02, ALG-14 |
| TN-K-010 | R-036, R-102 | §3.2, 4, 6.1 | ALG-07 |
| TN-K-011 | R-200, R-205, R-010 | §3 | — |
| TN-K-012 | R-201, R-207, R-212 | §3 | ALG-01, ALG-02 |
| TN-K-013 | R-124, R-047, R-107 | §3, 3.2 | — |
| TN-K-014 | R-202, R-174 | §3, 3.1, 6.2 | ALG-06 |
| TN-K-015 | R-034, R-174, R-172, R-188 | §3.1, evidence §§1–2 | ALG-08 |
| TN-K-016 | R-034, R-047 | §3.1 | ALG-08 |
| TN-K-017 | R-203, R-101, R-102 | §3, 4, CI §6 | ALG-07 |
| TN-K-018 | R-203, R-035, R-170, R-187 | §4, 6.2, CI §6 | ALG-07 |
| TN-K-019 | R-200, R-030, R-091, R-121, R-186 | §3, 3.2, 6.2, contracts §1 | — |
| TN-K-020 | R-031, R-200, R-202, R-203 | §4, 6.1 | ALG-06, ALG-07 |
| TN-K-021 | R-034, R-109, R-201, R-218 | §3, 4, 7.1, CI §3 | ALG-01, ALG-07 |
| TN-K-022 | R-031, R-006, R-215 | §4, 6.1 | ALG-07 |
| TN-K-023 | R-018, R-039, R-091 | §3.2, 5 | ALG-05 |
| TN-K-024 | R-039, R-109 | §4, 5 | ALG-05, ALG-07 |
| TN-K-025 | R-037, R-039 | §3.2, 5 | ALG-05 |
| TN-K-026 | R-109, R-204, R-053 | §6.1, 6.2, 7.1 | ALG-06 |
| TN-K-027 | R-103, R-203, R-223 | §6.1, 6.3, CI §6 | ALG-03, ALG-07, ALG-09 |
| TN-K-028 | R-101, R-108, R-110 | §4, CI §§6–7 | ALG-07 |
| TN-K-029 | R-100, R-034, R-110 | §7, CI §§1, 5, 7 | ALG-08 |
| TN-K-030 | R-006, R-110, R-104, R-105 | §7, CI §7 | ALG-07 |
| TN-K-031 | R-006, R-214, R-217 | §6.1, 7, CI §§7–8, 10 | ALG-07 |
| TN-K-032 | R-007, R-009, R-060–064 | §13 | ALG-01–07 |

## Disagreements for resolution

1. **Baseline updated.** Track 1 began at `efb8477` and now includes main at `dcb95bb`. L-0031 settles licences and schema IDs. Those are release and binding decisions and do not add tool requirements to Part I.
2. **TN-K-003, TN-K-027.** R-208 calls out invariant L2 sections. TS §6.3 also names provisional sections. Spell out the exact markers.
3. **TN-K-004.** R-209 and R-213 place deltas at the top. TS §6.3 and contracts §5 place them after touched requirements. Part I requires visibility.
4. **TN-K-005, TN-K-006, TN-K-008.** R-210 describes citations at the recorded revision. ALG-04 checks the current revision and ALG-03 uses content anchors. Distinguish historical citations from current resolution. R-210 attributes proof to persistent tags while R-218 describes scoped reports of observed checks.
5. **TN-K-007, TN-K-027.** R-103 does not name blessing metadata, which TS §6.1 and DEC-55 place under section-owner blessing.
6. **TN-K-010.** R-036 requires escalation to the lowest sufficient level. CP-0015 adds `agent`. Synchronize the schema and template in their owning packets.
7. **TN-K-011.** R-205 states three to five required fields. TS §3 lists two for Subject, Actor and Policy. Confirm each schema minimum.
8. **TN-K-012, TN-K-021.** R-201 and TS §4 describe freshness by subject digest. Alpha.1 also requires policy, blessed requirement revision and check inputs. Confirm the exact comparison fields.
9. **TN-K-016.** TS §3.1 mentions step trailers. R-034 and R-047 require attribution of who wrote or pinned the check. Confirm which observations establish independence.
10. **TN-K-018.** R-203 both forbids self-waiver and permits a labelled exception below verify. Align the PRD and gate on the exception and unwaivable claims.
11. **TN-K-020, TN-K-022.** R-200/R-031 describe refusal, while R-215/ALG-07 separate verdict and disposition. Preserve ALG-07's unconditional structural refusals.
12. **TN-K-023, TN-K-024.** ALG-05 leaves cycles and orphan descendants unspecified. Align the new reducer outcomes and the representation of a resolve decision with R-203.
13. **TN-K-025.** R-037 labels working-copy leases advisory. The runner needs explicit scope for any atomic reservation and must reconcile existing effects.
14. **TN-K-028, TN-K-030.** CI §6 uses reviewed commits and replies to the current evaluation. L-0027 and alpha.1 additionally require binding to a question and options. Degrade ambiguous native reviews. The person-present claim remains conditional on the outstanding security-key observation.
15. **TN-K-029, TN-K-031.** R-100 requires separation, while the prototype recorder has general write authority. Real fork, required-status and sealed no-network behavior are outstanding.
16. **TN-K-030.** R-104 separates external and in-repository holdout. The binding needs actual access prevention before claiming enforcement.
17. **TN-K-002.** L-0029 allows one M0 ratification sitting. Assure in R-208 and TS §6.3 retains two separate days as a product rule.

18. **CI registry.** CI §10 says `acceptance-passed`; the technical rule table says `acceptance-proven`. The public ID needs explicit reconciliation.
19. **Delivery boundaries.** CI §§3 and 5 mention merge-group handling before the R-152 point release, and CP-0042's old scope places `close` before the command matrix. The new parts distinguish a basic candidate binding and computed close from the later public capabilities. Confirm both cuts.
20. **Scope of the freeze.** Plan §4 calls for every later release before build. The assigned packet list names alpha.1, alpha.2 and GA and preserves CP-0014 as evidence. The point-release scope rows still need full build contracts before dispatch.

This is an author trace for review. Approval requires the authorized decision.
