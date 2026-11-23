# Tenet

> Part I · Level L1 · Proposed M0 kernel · Provisional rule IDs. Binding and release details are in the technical specification and schemas.

# Part I · The standard

Tenet records intended outcomes, the evidence for them, who may decide and what happened. The rules apply to people and agents working through any conforming tool. A pack selects the rules and meanings needed for a project.

## 1. The specification process

**TN-K-001.** Projects must put intent at its level. L0 states vision, L1 requirements and adopted governance, L2 design, experience and plans, L3 the definition of a change, and L4 implementation and tests. A starter document can contain sections of different levels. The same ownership rules apply to each section. Holdout scenarios, the append-only ledger and the generated work view are distinct from the ladder.

**TN-K-002.** Only the authorized vision decision-makers may change L0. They must ratify the vision from version 1. At assure, ratification requires two person-present decisions on separate days. The Owner appoints who can act for the project and each area.

**TN-K-003.** Changes at L1 and changes to protected or invariant sections at L2 must have approval from each affected section owner. Other L2 changes need review and passing checks, with notice to the owner. L3 is shaped and reviewed, with definition approval where the lane requires it. Builders act at L4 through the gate, with no access to holdout scenarios.

**TN-K-004.** A proposed L1 or L2 change must show additions, modifications and removals by identifier on the review that carries it. The proposal can accompany the change it governs or use its own spec work item. An unchanged meaning may be reviewed as a clarification. Mixed-level changes follow the strictest approval they touch and still account for every affected owner.

**TN-K-005.** Requirements must have a stable identifier that is never reused, the vision items served, their origin, and enough information to locate the governing section. Observed behavior and documented statements cite their sources. Asked statements record a person's answer or explicit adoption. Inferred statements remain marked as such.

**TN-K-006.** Work must name the requirements it implements. The traceability check checks unique identifiers, resolved links and citations, and coverage of active vision items or an explicit out-of-scope entry. Acceptance identifiers are local to their work item. Requirement tags connect continuing checks to the corresponding requirement. A tag or a stored status alone gives no proof of adequacy.

**TN-K-007.** A person with authority for a section must bless it before it governs work. Onboarding inventories the available sources, asks people about intent, and lists conflicts and open questions. Inference needs explicit adoption or correction before blessing. The decision records its attribution or proof and the adopted revision. A self-recorded blessing is advisory.

**TN-K-008.** Context must serve the last blessed text, check its integrity, and report text edits and changed sources. Rejecting or deferring an edit retains the last blessing. Confirming changed sources records renewed anchors. Context names the reason for inclusion, owner and omitted identifiers. Drafts appear as marked hints when requested.

**TN-K-009.** Projects must preserve links and rules when splitting or compacting a specification. The check warns as a document approaches its budget. A change crossing the budget is eligible for a blocking finding only in the shared integration check and under the applicable rule mode. Assignments carry the applicable sections within budget. The work view shows unresolved references, changed sources and unproved requirements.

**TN-K-010.** Work must stop and escalate on a governing conflict or when a stop threshold reaches its limit. The report quotes the conflicting text or records the threshold, identifies the affected work and names the lowest authority able to resolve it, including `agent` when the agent definition is the issue. The work view shows who acts next.

## 2. Records and work items

**TN-K-011.** Implementations must use the seven primitive schemas in `kit/schemas/`: `subject.json`, `actor.json`, `claim.json`, `evidence.json`, `decision.json`, `event.json` and `policy.json`. Their meanings follow below. A minimally valid record lacking information required by a claim remains a record. The evaluator reports the missing information and cannot count it as satisfying that claim.

**TN-K-012.** A subject must identify the exact content under evaluation. Subject kinds are declared in a pack and can include code trees, file sets, specification sections, named areas and other governed content. The code subject detects code changes. The evidence records the inputs used by the check separately.

**TN-K-013.** An actor must be identifiable as a person, agent or service. A run records the accountable chain, granted scope and expiry, execution environment and input provenance, and available usage with cost source. By default record summaries and hashes. Transcripts require opt-in and secrets stay out of records.

**TN-K-014.** A claim must state what is required and when it applies. The pack or policy specifies accepted methods, pass criteria, lifetime, owner and waiver eligibility. Separate applicable claims all matter. If a continuing claim's declared dependencies are absent, use its whole area. Unknown applicability is an explicit result.

**TN-K-015.** Evidence must say what subject and claims were checked, by which method and producer, with which inputs and outcome. Account for expected, executed and passing cases. A method finding none of its expected cases is inconclusive. A required distinguishing check shows the agreed failure on the baseline, with a harness failure recorded as inconclusive. Methods are admitted by claim and lane, with no universal method ranking.

**TN-K-016.** Evidence must carry the required provenance and independence separately. Provenance rises from local to continuous integration to continuous integration with observed trust. Independence rises from the claimant's own run through same-definition, different-definition, different-model-family and person. Missing strength is lowest and self evidence cannot satisfy a claim. The binding records who wrote or pinned the check and who wrote the change.

**TN-K-017.** A decision must record the authorized actor, scope, subject, target, proof and applicable policy. Its kind is approve, waive, choose, delegate or resolve. A request states its question, ordered options with stop first, recommendation, decision-maker and deadline, with stop as the default. Its answer binds the request, subject and choice. An option changing scope cannot approve the old scope.

**TN-K-018.** A waiver must identify the claim, scope, reason and expiry and meet the proof required by policy. Unwaivable claims remain required. The person responsible for the change and agents acting for them cannot waive it where separation is required. Below verify a permitted self-waive is labelled. A continuing promise retires by its owner's approval. A contrary observation defeats the affected promise until restored.

**TN-K-019.** A work item must group one intent, its claims, evidence and decisions, with stable identity and a unique alias where used. A proposed change can be the container in a lightweight pack. Packs declare work types, including `spec`, `agent` and `factory` where supported. Changes to a factory definition are governed work. Leases, assignments, tasks, results, ledger entries and escalations map to the primitives or views of them.

## 3. Gate, events and replay

**TN-K-020.** The evaluator must account for every applicable claim before advancement. An evidence claim is satisfied by current evidence of an admitted method, completing its pass rule at the required strength. An approval claim is satisfied by a current approval of the required strength. A current waiver counts only where allowed. An approval cannot replace evidence.

**TN-K-021.** The evaluator must compare the subject and the inputs that govern the claim. Policy and approval come from the applicable target and evaluation, and time-limited evidence applies within its validity window. A new evaluation can use an earlier observation only when the observation still satisfies the new claim basis. A decision for changed intent, scope or policy is not current.

**TN-K-022.** Evaluate every applicable rule. The gate must report individual claim results, verdict, disposition, reasons and next action. Any enforced applicable refusal blocks despite advisory findings. Observe records a finding, advise shows what would have blocked, and enforce blocks as stated by the rule. The lead reason and next action follow the gate algorithm. Keep the actual blocker visible when the first finding is advisory.

**TN-K-023.** State changes must be recorded as immutable events. Each event names the causal heads the writer saw. Station and holding status are separate. The reducer orders by ancestry with a deterministic tie break, ignores identical duplicate events, flags conflicting reuse of an identifier and holds events with unavailable ancestry and reports cycles as structural findings. Incompatible concurrent state changes require a resolution that names the conflicting heads.

**TN-K-024.** Replay must use the original evaluation instant and snapshot, including the target policy, store revision and trust observation. Its argument identifies the rule and evidence or decision for each claim. Re-evaluation under today's inputs is shown separately. A pending move is tentative and cannot satisfy a later gate. When the pending limit passes it becomes unjustified unless justified under the replay contract.

**TN-K-025.** An executor must show whether a lease is advisory or exclusive. Exclusive authority requires an atomic update in the claimed scope. Resumption uses the recorded work and run history, with no repeat of a completed step.

## 4. Policy, authority and trust

**TN-K-026.** The evaluator must read policy from the target of the proposed change and record the exact revision. Packs declare stations, lanes, work types, selectors, methods, roles and decision rights. Project and area rules may only tighten the policies they extend. Incompatible policies refuse with a reason.

**TN-K-027.** Changes to trust controls must carry the required change-policy approval. This approval cannot be waived. Changes that weaken evidence require approval from the owner of the evidence affected. An equivalent proving-case replacement needs the forge-verified approval strength. Ordinary mechanics receive normal review, with weakening flagged. Blessed copies and blessing fields are governed by section-owner blessing.

**TN-K-028.** Decision proof must meet the applicable minimum: person-present, then forge-verified, then key, then channel, in descending strength. Person-present requires evidence of a person's presence. Forge-verified records attribution to an authorized account and counts as enforced only when credential separation is attested. Delegation expires, and proofs bind their subject, request and policy.

**TN-K-029.** To claim protected verification, the verifier must separate code execution from attestations. The check environment runs the approved checks without write authority over the record store. The protected recorder handles the reported inputs as data and authenticates its own evidence. A signature identifies the recorder and protects the recorded bytes. The method, scope and check adequacy are assessed separately.

**TN-K-030.** An implementation must declare the guarantee of each claimed rule and the assumptions it needs. T1 is protected verifier source. T2 is evidence authenticated to that source. T3 is proof of human decisions where reserved. T4 is separation of decision-maker credentials from agents. T4 requires host attestation for enforcement. Record separately whether the integration requires a passing status. External holdout and containment count at the strength the environment actually provides.

**TN-K-031.** Views must report the actual strength: advisory guidance, detected findings, prevention by an exclusive executor, or enforcement conditional on current observed trust. Expired or unavailable trust lowers reported strength. Track what each level provides. Observe has advisory findings, protect detects and can stop ordinary mistakes, verify adds sealed checks and signed evidence, and assure adds person-present controls and external holdout. Required unavailable controls fail closed at verify and assure. An allowed override records acceptance without verification.

**TN-K-032.** A conformance declaration must name the version, applicable packs, classes and levels it claims. Classes are producer, evaluator, executor, renderer and project. Fixtures compare observable records and decisions at the declared strength. The standard's reference cases include unknown observations, scoped rollback, an irreversible migration boundary and a change to deployed content with no code change.

# Part II · Reference material

Reserved for worked packs, role and loop examples, adoption journeys, reference fixtures, and non-normative tool and format mappings.
