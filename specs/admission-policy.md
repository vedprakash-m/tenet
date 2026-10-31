# Legitimate-user admission — review draft

Status: **unsigned; no implementation authorized**. Prepared October 29, 2026 after the S8b workload and abuse-composition observations. The existing 120/minute IP + five/minute IP/account correctness repair is independent and remains the implementation until this contract is reviewed and signed off. This draft changes starter policy, not Tenet kernel authority, counters, schema or budgets.

## Problem and requirements

The canonical workload (PRD §5.16, TS §12.7) requires twenty clients, successful operation latency and at least 5,000 samples. The present shared-IP ceiling admits too few operations, including when users share the same-origin proxy/NAT. The post-repair observation admits only 205 successes. Raising or disabling a limiter in the workload would conceal the problem. Retain real cryptography, hashing bounds, request/body/pagination bounds, actor/object/role authorization and CSRF. This contract does not close RSS, workload consumers or qualification.

## Proposed policy A (recommended)

All budgets are per live API process, fixed 60-second windows beginning with their first counted attempt, using independently bounded local stores as today (5,000 retained keys per store). Counter eviction under identity churn is not a hard-window guarantee; this local twenty-user/2,000-user-record envelope and loopback binding do not qualify a public multi-IP deployment. Review must disposition that finite-store limitation explicitly. A restart resets these counters; no distributed/durable guarantee is introduced. They count attempted requests even when later validation, authorization, contention or business logic refuses them. No refund. No request field grants a trusted identity.

| Layer, in evaluation order | Key | Ceiling | Applied before |
|---|---|---:|---|
| Coarse network admission | The plugin's normalized socket IP, with current IPv6/default proxy semantics | 6,000/minute | Body parsing, database lookup, hashing or session writes |
| Anonymous/credential-attempt admission | Normalized socket IP | 120/minute | Body parsing, session mutations and hashing; read-only classification may precede this under the coarse bound |
| Authenticated operation/session-management admission | Database-verified current user ID, independent of session ID/IP | 300/minute | Body parsing, session writes, CSRF/feature handlers and hashing |
| Password-attempt admission | Verified user ID | 5/minute | Password verification/change and session mutations; independent of session rotation/IP |
| Existing sign-in account admission | Current socket-IP/account key and current validation ordering | 5/minute | Credential verification; retains current CSRF/session ordering |

The 120 and 300 branches are mutually exclusive. Matched `POST /api/auth/sign-in` and `GET /api/auth/csrf` always use 120/IP, including when a valid session is presented, so a session cannot lift account-guessing capacity. A verified actor's `GET /api/auth/me`, `POST /api/auth/sign-out` and `POST /api/auth/password` instead use 300/user, independent of anonymous health traffic. Password attempts additionally pass 5/user before maintenance or hashing. Actor-budget exhaustion can still deny that actor's operations until reset; coarse-IP exhaustion can deny all callers sharing it. No absolute availability guarantee is made under those explicitly shared/exhausted budgets.

**Narrow signed-out status path:** matched `GET /api/auth/me` with no `sid` cookie at all returns its existing constant 401 under the coarse ceiling only, without a database read, mutation or hash. This lets the existing browser's post-sign-out fresh read confirm cookie/session absence even when anonymous health traffic consumed 120/IP. It does not authenticate, establish an actor, disclose a user, create an exemption for an authenticated operation or accept a receipt as authority. Present-but-empty, malformed, expired, revoked and unknown cookies do not take this path; they require normal bounded classification and anonymous/user admission. An attacker can obtain only the same constant signed-out response by omitting a cookie; the 6,000/IP coarse bound remains.

Classify by matched method and server route pattern, never raw client URL text, so encodings/query text/routing aliases cannot select a cheaper bucket. Health and unmatched routes always use 120/IP before any lookup. No workload/browser exemptions. Neither session rotation nor IP changes reset a user's bucket. Do not trust forwarded headers, an email, a role, a cookie payload or a client-supplied user ID as admission identity.

300/minute gives each legitimate user headroom above the current driver’s approximately 240 operation attempts/minute. The 6,000 aggregate is an explicit network ceiling, not a promise that every actor can simultaneously consume its full allowance plus anonymous traffic. Twenty-user admission must be demonstrated, not inferred from the arithmetic. These exact values require owner approval; they are not current defaults.

## Session and hook mechanism

1. Set correlation headers and apply coarse admission in `onRequest`, before body/DB/hash work. Separate manual `createRateLimit` factories own the coarse, anonymous, user and password counters; only the existing sign-in account check uses the route hook. Manual checks must not set the plugin's shared “already checked” marker.
2. **Registration diagnostic:** install an `onRoute` collector of options objects and an ordinary synchronous `onReady` diagnostic that validates the collected options when its hook runs. Do not call/await `app.ready()` from inside that hook. Groups visible then refuse startup. A group injected by a later `onReady` hook or a detached served configuration can escape this diagnostic: it is **not a guarantee that every unsupported served configuration prevents listening/export**. Existing ready/listen/inject entrypoints stay unchanged; no custom finalization method is introduced. The actual-request guard below is the authoritative counter-partition boundary. Grouping is unsupported, not silently partitioned.
3. **Actual-request metadata sealing, before any counter:** inspect the actual `req.routeOptions.config.rateLimit`, not the collector. Normalize `undefined` or `false` to an immutable `undefined` binding; route-level opt-out was already handled at registration and cannot disable mandatory counters. For object options require a plain (`Object.prototype`) or null prototype and own data properties only; reject accessors/custom-prototype metadata without evaluating getters. Reject non-undefined `groupId`. Copy supported own data fields into a private null-prototype record, define an **own non-writable, non-configurable data property `groupId: undefined`**, and freeze the record. Pin the actual config's `rateLimit` property to this safe value as non-writable/non-configurable. If descriptors cannot safely be normalized, fail closed. Only this field/record is sealed; unrelated route metadata stays untouched. Do not rely on `Object.freeze` to freeze accessor behavior or inherited properties.

   The private data record prevents getter/prototype changes from affecting the plugin's later `groupId` read, including across the awaited user-key call. Later hooks cannot replace the pinned binding. A detached/later unsupported served config receives the existing generic 500 before counters/handlers; ordinary mutation after a successful coarse check may consume that attempt but cannot create a partitioned counter. Log no group value or request secret. No universal pre-listen rejection, availability under invalid application configuration or protection against arbitrary application code removing the admission hook is claimed.
4. Apply the classification rules above. The constant no-cookie `/me` path has no lookup. For matched non-auth operations and authenticated session-management paths presenting a cookie, validate the existing signature and read session/user without touching/deleting rows. Failure, missing user/session or absolute/idle expiry yields no admission actor. Coarse admission bounds these reads. A held WAL writer must not cause an admission-only write.
5. Charge the selected branch and, for verified password requests, its additional five-attempt bucket. Publish the same 429 shape and positive Retry-After; preserve correlation IDs. Headers describe the denying layer, or most specific successful layer (coarse only for the constant signed-out status path). Preserve sign-in's five-attempt headers on its denial. No refused admission clears cookies or updates rows.
6. Only after admission run bounded maintenance in `writeTx`. Re-read signature/session/user and expiry with the current time inside the transaction rather than carrying lookup data into authority. Set `req.actor` only from this current result. Concurrent sign-out/password change/expiry cannot authorize a request or revive a session. Existing expired-cookie clearing and 503/cookie preservation remain for admitted requests.
7. Continue existing CSRF, route account, role/object and feature checks. Admission never grants authorization. No actor/session cache, delayed revocation or new SQL schema is introduced.

Refactor the synchronous resolver into one small read/validate function reused by maintenance, rather than copying signature/expiry rules. Keep `resolveSession`'s current consumer interface; it still performs maintenance inside the existing HTTP write transaction. Admission only uses the read function. Preserve old return/read semantics for all direct callers and tests.

## Behavioral examples and test owners

All new cases belong in the neutral recipe and are also run by the loan golden fixture. Real HTTP/application/database behavior is required; a test of an isolated counter alone is insufficient.

| Example | Expected result | Test file |
|---|---|---|
| Unauthenticated request 121 from one IP | 429 before writes/hash, unchanged rows/cookies; quota and correlation headers | `server/test/abuse-limits.test.ts` |
| Six sign-ins for one IP/account below aggregate limits | First five reach uniform verification, sixth is 429; another account/IP has its own account bucket | same |
| Anonymous bucket exhausted; a previously authenticated member lists items | Its first authenticated operation can pass; sign-in itself remains IP-limited | loan fixture `server/test/admission.test.ts` |
| Authenticated operation 301; new session or new IP for the same user | 429 in each case, no maintenance; a different verified user has an independent budget | `server/test/admission.test.ts` |
| Forged, revoked, missing-user, idle-expired or absolute-expired cookie | Never receives a user bucket/actor; anonymous budget and existing denial apply | same, plus session tests |
| Session revoked/password changed between admission read and maintenance | Fresh read denies; no touch/revival/privileged effect from stale admission data | same with real separate SQLite connection |
| Writer held during exhausted admission | 429 without entering the session write path; an admitted request still has the existing bounded 503/recovery | `server/test/busy-session.test.ts` |
| Coarse attempt 6,001, including distinct account/user keys | 429 before body/session/hash; independent IP control; forwarded headers cannot bypass | `server/test/abuse-limits.test.ts` |
| Anonymous 120 exhausted while coarse has room; verified browser reloads and signs out | `/me` and sign-out use the actor bucket; follow-up no-cookie `/me` returns fresh constant 401 and the UI confirms signed out | browser + `server/test/admission.test.ts` |
| No-cookie `/me` versus empty/forged/revoked/expired cookie | Only absent cookie takes constant coarse-only 401; no lookup/write/hash and no actor; presented cookies follow normal classification | `server/test/admission.test.ts` |
| Sixth verified password attempt, including new session/IP | 429 before maintenance/hash; another verified user remains independent | same |
| Registration hook or an earlier ready hook injects a group visible to the diagnostic | `app.ready()` refuses startup; server remains unbound | `server/test/abuse-limits.test.ts` |
| A later ready hook changes grouping, or registration options detach from served configuration | Diagnostic may pass; actual request fails generic 500 before counter/handler work, never silently partitions | same |
| Accessor, custom prototype, or group value changes between validation and counter lookup | Accessors/custom prototypes are refused without getter evaluation; accepted metadata has its own pinned undefined group, so inheritance cannot partition counters | same |
| Later request hook attempts group replacement/mutation | Strict writes may fail; non-strict writes may be ignored. The pinned metadata stays unchanged and counters remain unpartitioned; detection/500 is not promised for every attempted write | same |
| Naive shared-marker composition | Five-attempt account regression fails | same |
| Full twenty-user workload and scheduled probes | Fresh production API, original security settings, sufficient successes and complete coverage; retain all errors/RSS failures | loan fixture `server/test/workload.test.ts` plus full driver |

Tests must not sleep a minute or weaken production windows to prove expiry: retain the established plugin store contract and add narrowly scoped clock-controlled integration only if the selected composition changes reset behavior. Keep pure controls separate from real-process workload evidence. Browser assertions stay against fresh current-source production UI; no retry/skips to hide refusal.

## Impact, alternatives and risks

Affected consumers: neutral and loan `app.ts`, session resolver and repository reads, sign-in route hook order, quota/error/correlation headers, current abuse/busy/session tests, new admission race tests, recipe version and full golden counts, browser fixture and workload reports, hardening/architecture docs. No dependency addition, SQL migration, public DTO widening or kernel change is intended. Existing generated apps do not automatically receive this update.

Alternative B: keep the same coarse and anonymous/security-route ceilings, but let authenticated operations share only the 6,000/minute IP pool. It is simpler by one bucket but lets one actor starve other users on the same proxy/NAT. Recommend A for isolation between authenticated users. Keeping today's 120/minute ceiling for all operations leaves the canonical workload unmet; it is not a completion strategy. Disabling abuse controls, reducing scrypt work/concurrency or relabeling refused traffic as successful samples is excluded.

Risks requiring review: exact hook ordering and request-group behavior in the installed plugin; stale admission versus current authority; pre-admission read work and native memory pressure; finite-store eviction/IPv6 scope; sensitive-route and constant-status coverage; accidental double charging; registration-diagnostic entrypoint completeness versus actual-request enforcement; descriptor/prototype normalization; refusal/header compatibility. No claim covers public multi-node or externally bound deployments; those remain a separate hardening decision. Review must verify actual-request metadata sealing, the honestly limited ready diagnostic and independent manual-counter stores before implementation. Do not substitute a bespoke unbounded map to bypass that issue.

## Acceptance and approval

1. Independent review (owner or explicitly authorized fresh reviewer) dispositions every finding, including actual-request metadata normalization, the explicitly limited registration diagnostic, finite-store envelope, independent counters and session re-read races.
2. Owner signs the final mechanism and ceilings. No runtime policy implementation before that point.
3. Red-first behavior/race controls, both runtime full feature loops, all repository gates and actual built CLI scratch UAT pass. Dependency/lock/kernel budgets remain stable or any necessary deviation returns for review.
4. Full unmodified workload records sufficient successful samples and every burst/hash/busy requirement on the intended tuple; RSS and other failed targets stay open until measured passing. No whole-application conformance claim.
5. Backfill canonical implementation facts, hardening/plan/changelog and immutable validation identity. Qualification ledger acceptance, independent implementation review, native/human/release gates remain separate.

Review/sign-off: **pending**. The first independent review (October 29) found two majors and one minor; this revision dispositions them for verification by the same authorized read-only reviewer. No final sign-off is inferred. This author’s source pass is not an independent review. No policy choice or subagent authorization is inferred from general continuation requests.
