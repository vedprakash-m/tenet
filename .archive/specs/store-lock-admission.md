# Specification: Lock-Bound Private Store Maintenance

> Status: Independently reviewed 2026-10-26; three findings accepted and dispositioned in §8. Owner approved option A and the bounded repair/canonical clarification on 2026-10-26. Implementation must follow TDD and the validation gates below; full migration remains unapproved.
> Owner: repository owner. Sources: technical specification §§7.3, 7.4, 7.5, 7.6, 7.7; CON-04, CON-05, SEC-12; migration review MC-2.

> Local implementation update, 2026-10-28: the supported unprivileged macOS route is available. LA-1–LA-7 are grouped in `packages/kernel/test/store-lock-admission.test.ts` with one real-process barrier fixture. Twelve red/green controls pass locally; existing 94 store/boundary/quarantine tests pass. Full local CI passes 1,226 tests/198 suites; 139 built UAT scenarios pass on Node 26.3.0 and 22.12.0 against the same 776,671-byte bundle. No remote CI or qualification is implied. Archived after local validation; implementation review and commit remain pending.

## 1. Outcome and scope

An existing owned store waiting for its transaction lock does not change protected directory/record permissions or create its private ignore file. Once the lock is acquired, it freshly admits compatibility before doing that maintenance. A cooperative fence publisher uses the same transaction lock, so it cannot install a transition/privacy fence between this admission and protected maintenance.

This repairs MC-2 only. It adds no migration writer, schema, port, reason, lock protocol, cleanup authority or arbitrary same-user-writer protection. Direct-writer APIs, migration recovery, privacy publication and rollback floors remain under their existing separate contracts. A malicious writer or a program that ignores the shared lock can still race filesystem operations; this change does not qualify those races.

## 2. Source finding

Current [acquire](../../packages/kernel/src/adapters/store-fs.ts) admits, attempts initialization, chmods the store directory, checks ownership/quarantine, admits again, chmods directory/records and may write `.gitignore`, then calls `claim`. A fence installed after either pre-lock admission can precede permission or ignore-file mutation. The later refusal does not undo that mutation.

Current [transaction](../../packages/kernel/src/adapters/store-fs.ts) already has an under-lock admission inside its try/finally, followed by journal repair and callback execution. Its finally releases only its matching lock. Reuse this boundary; do not add another orchestration path or acquire a second lock.

## 3. Proposed ordering

1. Keep pre-lock compatibility/path checks and fresh directory/marker creation as today. New stores use private creation modes; they do not need a preliminary chmod.
2. Remove the unconditional early directory chmod from `acquire`. Preserve ownership detection, explicit `open`-only quarantine, bootstrap lock identities, journal moves and stale-break rules. Inside the existing quarantine bootstrap-lock callback, after acquiring that lock and freshly admitting compatibility, chmod the directory to `0700` BEFORE invoking quarantine's journal/move callback. Keep this admission/chmod/callback inside its existing release try/finally. This preserves privacy while imported entries move, without pre-lock repair. Normal owned-store maintenance stays under the normal transaction lock.
3. Keep the last compatibility check before `claim`, but move the existing directory chmod, marker/state/previous/log chmod loop and missing private `.gitignore` creation into `transaction`, immediately after its fresh under-lock `admit` and before tail repair. Move, do not duplicate, these operations.
4. The moved maintenance runs within the existing try/finally. Admission, chmod, ignore-file or journal-repair failure must release this operation's matching lock and propagate its existing explicit error. No swallowed error, fake success or callback after failed maintenance.
5. A waiter may create/remove its own temporary lock bookkeeping; it may not alter a holder's lock or protected records. An under-lock compatibility refusal releases only the waiter's own acquired lock, if any. Lock bookkeeping is not a protected-record mutation guarantee.
6. Already-linked paths still refuse through existing path/record admission. Existing corruption fallback and its permission restoration occur only after compatible under-lock admission. Read-only calls remain free of permission maintenance.

## 4. Permission-repair boundary requiring owner approval

An existing directory that the current user can read/search but cannot write may previously have become writable through pre-lock chmod. A write-based lock cannot be acquired there first. The proposed repair does NOT chmod it in advance: normal acquisition fails explicitly without protected changes, and the user must restore owner write permission before retrying. Do not invent a successful repair response or weaken the lock boundary.

This applies equally to an unwritable imported/quarantine directory: explicit `open` does not bypass the bootstrap lock by first changing its mode. Ordinary writable copied/markerless directories retain their existing quarantine behavior and preserved imported bytes. Files/directories with overly broad but owner-writable permissions still become private at the mutating boundary after acquisition.

Alternatives:

| Choice | Consequence |
|---|---|
| A: defer permission restoration until locked; refuse unwritable existing directories (recommended) | Small ordering repair using existing protocol; explicit manual permission repair is a behavioral limit. |
| B: retain automatic owner-write restoration via a new lock outside the protected directory | Requires a new bootstrap/ownership and multi-lock protocol with its own races, crash tests and budget; not a bounded MC-2 repair. |
| C: keep pre-lock chmod and document the race | Does not satisfy MC-2 or the canonical pre-mutation fence boundary; not recommended. |

If A is approved, clarify technical specification §7.6's "mutating admission restores those permissions" rule: permission restoration requires acquiring the existing mutation/bootstrap lock; an unwritable directory is not automatically repaired before that lock. Preserve §7.5's private quarantine boundary: its directory is tightened under the bootstrap lock before any journal/move. Do not silently amend canonical behavior under a generic implementation request.

## 5. Behavior as examples and test ownership

All rows are planned checks, not results. Use existing [store.test.ts](../../packages/kernel/test/store.test.ts), [store-boundary.test.ts](../../packages/kernel/test/store-boundary.test.ts), [quarantine.test.ts](../../packages/kernel/test/quarantine.test.ts) and their real child-process fixtures. One bounded test fixture is justified only if existing hold-lock fixtures cannot express the admission barrier. No production timing hook is needed: the child may wrap its public `admit` method solely to announce/block immediately after successful admission; real filesystem operations, lock acquisition and process identities remain unchanged.

| ID | Example and exact acceptance | Test home |
|---|---|---|
| LA-1 | Writer A pauses after initial pre-lock admission. Writer B obtains the real lock, installs each reserved transition/privacy sentinel, makes deliberate compatible-store mode sentinels, then releases. A resumes: unsupported-record, no callback; exact protected bytes/modes/inventory match B's final snapshot. Own lock bookkeeping may disappear; no holder lock is removed. | store.test.ts |
| LA-2 | Repeat LA-1 with A paused after the last pre-claim admission. This catches the later record-mode/private-ignore branch separately. Remove private ignore before the race; refusal must not recreate it. | store.test.ts |
| LA-3 | With A owning the normal lock but before transaction's admission, install a sentinel through a test barrier; admission refuses before maintenance, A's matching lock is removed, protected snapshot unchanged. This tests post-claim re-admission, not permission for a product fence writer to bypass locking. | store-boundary.test.ts |
| LA-4 | Compatible owner-writable store with `0755` directory and `0644` records: callback observes `0700`/`0600`, missing private ignore is created, ordinary publication still succeeds. | existing store-boundary mode test, strengthened |
| LA-5 | Inject a chmod or private-ignore write failure after lock acquisition: reject with the actual error, zero callback/publication/tail repair, matching lock/temp bookkeeping absent; a subsequent compatible transaction succeeds once the failure is removed. | store-boundary.test.ts |
| LA-6 | Existing owned and markerless/imported directories set to readable/searchable but owner-unwritable mode: an unprivileged process fails acquisition without mode/byte changes or quarantine. Assert the child's effective UID is nonzero and equals the scratch directory's owner UID. A privileged runner must use a suitable unprivileged child identity and owned accessible fixture, or report this criterion unverified, never passing. No identity/account provisioning is authorized by this spec. | store-boundary.test.ts |
| LA-7 | Writable fresh initialization, copied/markerless quarantine, concurrent openers, corruption fallback, live contention/stale-break and existing future-schema/waiting-writer controls retain their exact behavior. With imported directory mode `0755`, observe bootstrap lock held and directory mode `0700` before the first quarantine journal/move; inject bootstrap chmod failure and prove release, no journal/move and exact imported bytes retained. | store.test.ts, quarantine.test.ts, existing boundary tests |

Coordinate child processes with explicit bounded barriers, not sleeps that presume a race occurred. Test timeouts clean up only the exact child PIDs and owned scratch roots. Snapshot modes/content/path inventory rather than mtime alone. Demonstrate LA-1/LA-2 failing on the original code before moving maintenance; mutate away the under-lock admission for LA-3's negative control, then restore it. No fake process identity or weakened Windows mutation gate.

## 6. Impact, feasibility and risks

Production scope: only [store-fs.ts](../../packages/kernel/src/adapters/store-fs.ts), moving existing maintenance within the same class and deleting redundant early chmod. No pipeline/shared-schema/core-budget change. Tests and their narrowly owned fixture may change; canonical clarification, plan and changelog follow approved implementation.

Current store budget is **24,653/25,920 non-whitespace characters** (1,267 free), measured with the existing quality tool on October 26. The proposed production move is expected to shrink code, but this is not a measured implementation delta. Verify actual deltas, function/file ratchets and unchanged caps after implementation. Shared aggregate has only five characters free; this repair does not use it.

Risks: relying on pre-lock permission repair (section 4); moving failures after lock acquisition (LA-5); changing imported/fresh bootstrap behavior (LA-6/7); tests that accidentally observe the wrong boundary (LA-1/2 explicit barriers); privileged permission checks (LA-6). No power-loss, hostile same-user race or qualified bridge claim.

## 7. Gates and completion

Independent review with every finding dispositioned, then owner approval of choice A and this bounded scope BEFORE implementation. After approval: failing real-process controls first, ordering repair, focused store/boundary/quarantine controls, typecheck/lints/coverage/build, unchanged quality/size gates, full supported-POSIX CI and built scratch UAT on current/minimum Node. The built exercise must drive a compatible permission-restoration case and fenced refusal with exact bytes/modes/inventory retained; a source-only adapter test is not its substitute.

Windows remains a tooling/read-only/platform-refusal environment. Permission, real lock/process and mutation UAT evidence must come from supported POSIX execution, not simulated Windows success. Until those gates run on the changed source, status remains local `◐`, not complete or qualified. Finalize canonical wording, archive this spec only when the approved repair is validated, update changelog/plan, audit ignore rules and run actual-change privacy checks. Commit/push only when separately requested.

## 8. Independent review dispositions

The retained migration reviewer independently checked this bounded specification against acquisition, transaction, quarantine and canonical permission rules. No tests or implementation ran during review.

| Finding | Disposition | Remaining proof |
|---|---|---|
| Quarantine would move imported records before the deferred directory chmod | Accepted; §3 now tightens the directory inside the existing admitted bootstrap-lock try/finally before invoking quarantine. LA-7 covers journal/move ordering and failure release. | Implement and prove with real filesystem/bootstrap ownership after sign-off. |
| Canonical restoration clause is §7.6, not only §7.4 | Accepted; sources and §4 name §7.6 and preserve §7.5's quarantine boundary. | Owner approval before canonical amendment. |
| LA-6 lacked executable privilege conditions | Accepted; assert nonzero child effective UID and matching scratch owner; privileged runs need a suitable existing unprivileged identity or explicit unverified result. | Genuine POSIX observation; unverified is not passing or feature completion. |

These are specification dispositions, not a second review claiming the remedies pass. The reviewer confirmed LA-1/2's bounded barriers can expose the race, LA-3 covers re-admission, and budget claims remain appropriately unmeasured. Subsequent owner approval is recorded in §9; none of MC-1/3/4 or full migration is included.

## 9. Owner sign-off and execution prerequisite

On 2026-10-26 the owner selected `approve-a`: implement this bounded lock-bound maintenance repair and clarify the canonical permission rule, accepting explicit failure for owner-unwritable stores until write permission is restored. This authorizes neither an external lock protocol nor schema 2, migration, budget changes, host/account setup, commits or pushes.

The local environment is Windows, with no installed WSL distribution observed in the preceding validation. LA-1 to LA-7 require real POSIX locks, process identity, mode semantics and directory fsync. Before runtime edits, establish an available supported-POSIX execution route for the failing controls; do not mock process identity, override the mutation gate, treat a Windows setup failure as the target regression, or replace it with a source-shape assertion. Owner sign-off is recorded, but a missing execution prerequisite is still a blocker, not evidence that TDD or final gates passed.
