<!-- DRAFT, prepared 2026-11-03 for the owner under decision 12 A (specs/decision-packet.md section 12). Nothing here has been sent. Every name, address and identifier is a placeholder in angle brackets. Figures that the plan owns are cited by section, not copied. -->
# External requests: drafts and tracking

These are four requests that have long lead times. Preparing them is not running anything. A request only asks someone to confirm that access or help exists. Each spike, evaluation run, recruitment, spend and publication still needs its own authorization from the owner (plan sections 4.5 and 12.13), and no reply to a request here grants one.

## How to use this file

1. The owner fills the placeholders (`<OWNER NAME>`, `<RECIPIENT>`, and so on) and sends each draft by hand. Nobody and nothing else sends them.
2. Record the send date and the reply in the tracking table below, then record what the reply settles in `specs/plan.md` (section 4.5 for owner gates, section 13 for a dated entry). This file is not a progress record and is not evidence of any requirement.
3. Do not put real account identifiers, tenant identifiers, credentials, personal addresses or participant names in this file or anywhere in the repository. Keep them with the owner.

Every draft states the same four limits in its "Does not authorize" line: no run, no spend, no recruitment, no publication.

## Tracking table

| # | Request | Recipient | Reply owner | Drafted | Sent | Replied | Settles (record in) | Unblocks |
|---|---|---|---|---|---|---|---|---|
| 1 | Host access: macOS arm64 workstation, VS Code stable, Local agent harness, Copilot plan and policy | `<RECIPIENT: workstation provider and Copilot organization administrator>` | `<OWNER NAME>` | 2026-11-03 | not sent | none | Tuple fields and policy answers (plan section 4.1; `docs/user/qualified-tuple.md`) | SP-08, SP-01, SP-02, SP-06, SP-10, SP-12 can be authorized; AC-28, AC-16, AC-17, AC-25 host-visible cases |
| 2 | Model tuple and evaluation account | `<RECIPIENT: account or billing administrator>` | `<OWNER NAME>` | 2026-11-03 | not sent | none | Open items of plan section 4.5 (evaluation account) | SP-04, SP-05, SP-11, Q-16 funding, RSC-08, AC-12 and AC-19 cost measures |
| 3 | Participants: interest request, no commitment | `<RECIPIENT LIST: held by the owner, not in this repository>` | `<OWNER NAME>` | 2026-11-03 | not sent | none | Count of interested builders by cohort | AC-02 formative sessions, AC-12 pilot (PRD section 6.6.2; plan sections 9.4, 12.12 row I) |
| 4 | Release and review prerequisites: publisher and name, signing identity, external reviewer, clean rebuild environment, reserved tasks storage | `<RECIPIENT: one per item>` | `<OWNER NAME>` | 2026-11-03 | not sent | none | Plan sections 4.5, 9.3, 9.5, 12.12 row J | ENG-11, AC-11, release chain, qualification campaign (reserved tasks) |

Reply states to use: `not sent`, `sent`, `partial reply`, `answered`, `declined`. Add the date with each change.

---

## Request 1: Host access

**Purpose.** Tenet has no recorded qualified tuple, and the VS Code runs so far did not record the Copilot extension version (plan section 4.1; `docs/user/qualified-tuple.md`). A green GitHub macOS runner is not installed-host evidence (plan section 12.13). Several spikes cannot start until a native macOS arm64 workstation and a Copilot setup that allows the needed features exist.

**Exact ask (draft text).**

> To: `<RECIPIENT>`
> From: `<OWNER NAME>`, `<CONTACT>`
> Subject: Request to confirm host access for Tenet host testing
>
> I am asking whether the following can be made available, and on what terms. This is a request for information only; please do not set anything up yet.
>
> 1. A native macOS machine with an arm64 processor, with a user account that Tenet testing can use alone. Please say who owns the machine, whether the account is isolated from other work, and where VS Code user data and workspaces would be stored.
> 2. VS Code, stable channel, desktop. Please say which version is installed and whether the version can be pinned for the length of the testing.
> 3. The agent harness in VS Code set to run locally (the "Local" agent harness), not a cloud or remote harness.
> 4. A GitHub Copilot plan, and any organization policy, that allows all of: agent mode, plugins, custom agents, and subagents. Please say which plan this is, which of those four features are enabled or disabled by organization policy, and whether the plugin location setting (`chat.pluginLocations`) is permitted.
> 5. Sign-in done by me, by hand. No production credentials should be on the machine.
> 6. The ability to keep the machine awake and the screen unlocked for runs of at least 16 minutes. An earlier run stopped when a screen locked.
> 7. Permission to record the versions of VS Code, the Copilot components, the model name as the host shows it, the operating system and architecture, Node.js and Git.
>
> Please reply with what is available, what is not, any policy that blocks an item, and who would approve use.

**What waits on it.**

| Spike | Why it needs this host |
|---|---|
| SP-08 | Completion cases on the qualified tuple (reviewer tool list, context isolation, parallel dispatch, dead or cancelled child, native questions, `usages`). Its earlier authority is used up (plan section 12.14), so a new authorization is needed. |
| SP-01 | The 15-minute command test needs a rerun; the earlier attempt hit a test-runner timeout and measured nothing about the host (plan section 4.1). Also enable, disable and uninstall. |
| SP-02 | Which instruction file loads, `.tenet/` indexing, plugin data path, token estimate accuracy. |
| SP-06, SP-10 | Dispositions on the qualified tuple. |
| SP-12 | Command line versus MCP measurement; N=3 observed so far against the bar in plan section 4.1. |

**Unobserved today (do not read any request as claiming otherwise).** Parallel dispatch on the tuple, cancelled children, `usages`, instruction-file precedence, and whether `.tenet/` is excluded from the host's indexing. The full list is in `docs/user/qualified-tuple.md`.

**Does not authorize.** No spike or run (each needs its own named authorization, plan sections 4.5 and 12.13); no spend; no recruitment; no publication; no account setup, switching of accounts or installation by anyone other than the owner.

**Owner of the reply.** `<OWNER NAME>`, who ran the earlier host observations with their own Copilot account (plan section 4.1).

**Unblocks when answered.** The owner can authorize SP-08, SP-01, SP-02, SP-06, SP-10 and then SP-12 by name. These feed AC-28 (never waivable) and the host-visible cases of AC-16, AC-17 and AC-25, and requirements AGT-02, REV-01, AGT-03, AGT-05 and SEC-08, which depend on the SP-08 and SP-02 observations. Plan section 1 states how many Musts are host-only and how many are qualified today; read that figure there.

---

## Request 2: Model tuple and evaluation account

**Purpose.** A qualified tuple names a model, and Tenet needs to know how that model is observed. How `Auto` behaves is SP-04. Labeling a model for RSC-08 needs golden-suite results, which need an evaluation account. Decisions 21 B and 22 A already say: use the existing account in serialized windows, use included allowance only, and allow no overages. The items below remain open (plan section 4.5).

**Exact ask (draft text).**

> To: `<RECIPIENT>`
> From: `<OWNER NAME>`, `<CONTACT>`
> Subject: Request for account and model information for Tenet evaluation
>
> I am asking for information about an account that would be used for evaluation runs, in serialized windows, within its included allowance, with overages turned off or impossible. Please do not make any change or start any run.
>
> 1. Model: which model name and version the host will use, whether organization policy fixes the model, and whether `Auto` selection is allowed or can be turned off. Please say how the model actually used for a request can be seen afterward.
> 2. Account: which account would be used. Please send its identifier to me directly; it must not be written in any repository or shared document. Please say what the account's terms and organization policy say about automated or repeated evaluation use, unattended runs, and capture of results.
> 3. Allowance and enforcement: the included allowance for the period, how usage is counted, and how overage can be prevented in a way that someone other than me can verify (for example a budget set to zero by an administrator).
> 4. Limits: the finite included usage and the maximum number of cases we can plan within it.
> 5. Isolation: whether a separate profile, operating-system user or machine can be used so that no personal or production work shares the account session.
> 6. Authorization: who must approve each evaluation run before it starts.
>
> Please reply with the answers and with anything that cannot be provided.

**Still open at the plan (section 4.5), listed so the reply can be matched to them.** The account identifier; terms and organization-policy checks; externally verified enforcement of no overages; finite included-usage and case limits; isolation; run authorization. No paid fallback, purchase, account switching, credentials or live access is authorized. Funding for Q-16 is tied to SP-05 and SP-11 (plan section 4.3), and must be confirmed before the golden-task spend begins.

**Does not authorize.** No run, including SP-04, SP-05 or SP-11; no spend, no upgrade and no purchase; no recruitment; no publication; no use of the account by anyone, including the sender.

**Owner of the reply.** `<OWNER NAME>`.

**Unblocks when answered.** The owner can decide whether SP-04, SP-05 and SP-11 may be authorized and whether Q-16 funding is confirmed. Those feed the model qualification table (plan section 9.2), RSC-08, the cost measures of AC-12 and AC-19 (PRD section 1.6 targets), and the golden-task campaign in plan section 9.3.

---

## Request 3: Participants (interest request, no commitment)

**Purpose.** The qualification pilot needs 8 to 12 external technical builders, each doing at least 2 task pairs, with a follow-up two weeks later (PRD section 6.6.2). Separately, the formative first-use check for AC-02 needs 5 builders who do not already know Tenet, and plan section 12.12 row I requires six formative sessions. Scheduling takes the longest, so the first step is to find out who might be interested.

**Exact ask (draft text, for the owner to send to people the owner chooses).**

> To: `<RECIPIENT>`
> From: `<OWNER NAME>`, `<CONTACT>`
> Subject: Would you be interested in testing a developer tool?
>
> I am building Tenet, a tool that works inside GitHub Copilot in VS Code to help it carry out a coding task step by step. I am looking for people who write software and might be willing to try it on real tasks later, and to give their opinion.
>
> This message asks for nothing except whether you are interested. Replying "yes, keep me in mind" does not commit you to anything and you can say no at any time.
>
> If a study goes ahead, you would first receive a separate description of what is involved, the time required (`<TIME ESTIMATE: owner to set after the study protocol is frozen>`), what would be recorded, and a consent form. Consent to take part in the research is separate from agreeing to use the product, and you could agree to one without the other. Research data would be deleted 90 days after analysis unless you separately agree to a longer period, and you could withdraw at any time.
>
> If you are interested, please reply with: whether you write software regularly, whether you use GitHub Copilot in VS Code, and whether you already know Tenet. Do not send any project code or private information.

**Cohorts the replies are sorted into** (the owner sorts them; the text above does not promise a place in either):

| Cohort | Size and shape | Source |
|---|---|---|
| Formative first use | 5 builders who do not know Tenet; six formative sessions in all | PRD AC-02; plan sections 7.5 and 12.12 row I |
| Qualification pilot | 8 to 12 external technical builders, at least 2 task pairs each, two-week follow-up | PRD section 6.6.2 |

Whether a person may be in both cohorts is not settled in the sources; the owner decides before sorting replies.

**Does not authorize.** No recruitment beyond sending this message to people the owner picks (recruitment needs its own authorization, decision packet section 12); no scheduling and no commitment of anyone's time; no collection of any data about a participant; no run; no spend; no publication. A reply does not count as consent to research or to product use.

**Owner of the reply.** `<OWNER NAME>` reads and holds all replies. Names and contact details of respondents stay outside the repository.

**Unblocks when answered.** The owner can authorize recruitment for the formative sessions (AC-02) and, later, the pilot (AC-12, PRD section 6.6.4; plan section 9.4). The decision packet notes that if the owner worries about scheduling people against an unfinished build, group 3 is held until decisions 1 and 2 settle (alternative B); this draft asks for interest only and fixes no dates.

---

## Request 4: Release and review prerequisites

**Purpose.** Five items must exist before release and each takes time to arrange. They are asked for together because they close under plan sections 4.5, 9.3 and 9.5 and share the same owner. They can be sent to different people; send each part on its own if the recipients differ.

**Exact ask (draft text, one part per item).**

> To: `<RECIPIENT>`
> From: `<OWNER NAME>`, `<CONTACT>`
> Subject: `<one of the five subjects below>`
>
> **4a. Publisher, namespace and final name.** I need to know under which publisher and namespace Tenet could be published, whether the name `<PROPOSED NAME>` is available there, and what the process and conditions are. Please do not reserve or register anything yet.
>
> **4b. Signing identity.** I need an identity that can sign a release tag and a provenance attestation. Please say which kinds of identity are available (for example a key held by me or one held by an organization), who controls it, and how it can be revoked. Please do not create or send any key.
>
> **4c. External reviewer.** With a single maintainer, a change to executable content is held for a public 72-hour review window on an open pull request, and an external reviewer is asked when one is available. The release notes then say that no second-maintainer review occurred. I am asking whether you could act as that reviewer, in what hours you could respond, and what you would need to see. Review by an automated agent does not count in place of a second maintainer.
>
> **4d. Clean environment for an independent rebuild.** I need a machine or account that has never held the Tenet working copy, where the source and dependencies can be fetched fresh and built twice to compare the results. Please say what operating system, Node.js versions and network access it offers, and who controls it.
>
> **4e. Storage for 10 reserved qualification tasks.** I need a location outside the public task catalog, with access limited to named people, where reserved tasks can be kept so evaluated subjects cannot read them. Please say who administers it, who could be given access, and how access is logged.
>
> Please reply with what is possible and any conditions.

**Does not authorize.** No reservation of a name, publisher or namespace; no creation of a key or signature; no review of anything private; no rebuild or evaluation run; no storing of tasks until the owner confirms the location; no recruitment; no spend; no publication, signing or tagging. Release approval stays with the owner roles in plan section 3.1.

**Owner of the reply.** `<OWNER NAME>`.

**Unblocks when answered.**

| Part | Settles | Needed for |
|---|---|---|
| 4a | Publisher, namespace and final name (plan sections 4.5, 9.5; section 12.12 row J) | Finalized `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `NOTICE`; publication |
| 4b | Signing identity | Signed tag and provenance attestation (plan section 9.5); AC-11 (never waivable) |
| 4c | External reviewer for the 72-hour window | ENG-11 (PRD section 5.9.2) and the disclosure in release notes |
| 4d | Clean environment | Independent source and dependency rebuild (plan section 9.5, section 12.12 row J) |
| 4e | Reserved task storage | The 10 reserved qualification tasks (plan section 9.3), protected grading and the qualification campaign (section 12.12 row I) |

Before any publication, the pre-publication source review in `docs/release-checklist.md` is also required. It is not part of this request.
