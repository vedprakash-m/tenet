# Approved admission implementation — October 29, 2026

Status: **◐ local implementation; final validation in progress; uncommitted and unqualified.** The [owner approval](admission-approval.md) follows the [independent design review](admission-review.md). This report supersedes earlier unsigned-policy notes; the earlier reports retain their historical results.

## Implemented behavior

Recipe 0.4.0 implements the approved independent coarse-IP, anonymous/credential, verified-user and password-attempt budgets while retaining the existing sign-in check. The admission lookup reads current signed session/user rows without touching or deleting them. Existing immediate write transactions re-read current authority before publishing the request actor. Admission stores only a temporary request quota identity, removed before handlers.

Only a GET account-status request with no session-cookie property takes the constant signed-out path. Empty, forged, revoked, expired and missing-user cookies retain anonymous admission. Credential routes, health and unmatched routes remain anonymous regardless of cookie; matched routes determine classification. Actual served rate metadata is descriptor-checked, copied, sealed and pinned; startup collection is only a diagnostic. There is no arbitrary application-code sandbox guarantee.

The browser exhaustion regression owns a second real source server, database, token and allocated port. It preserves the original journey assertions and limits, builds fresh production UI output and removes its owned resources. This proves locally that anonymous exhaustion permits verified reload, sign-out and fresh signed-out confirmation.

## Additional defects reproduced and repaired

1. **Retry work could begin after its absolute deadline.** A real held SQLite writer plus a synchronous child-process event-loop delay reproduced a late successful transaction after the one-second retry budget. The helper now checks the absolute deadline before attempts and again inside the acquired immediate transaction before invoking the callback. This bounds when work may begin; it cannot preempt a callback or an already blocked event loop. The regression also proves a later independent transaction can succeed.
2. **A page of items materialized the entire active-loan set.** Real full-size seeded browsing returned 5,000 loan rows to JavaScript for each 25-item page. The fixture now uses indexed SQL existence checks within the page query, returning only page rows. A driver observation checks actual row counts and fresh availability after reserve/return; no SQL-text imitation, cache or schema change is used.

## Evidence and remaining work

The initial approved-policy workload had enough successful traffic but failed memory and never observed a busy refusal. The deadline repair restores expected busy observations. Page-bounded browsing reduces allocations, but its current-runtime full measurement still exceeds the memory target; the minimum runtime passes its local measured targets. Original failed observations remain recorded. Fixed-statement reuse is being evaluated separately in scratch and is not accepted on the strength of passing unit tests alone.

Final CI, built-CLI UAT on both runtimes, exact source/artifact identities and final measurements will be recorded in admission-validation.json. No dependency, lockfile, cryptographic cost, concurrency, security limit, kernel protocol, schema or quality budget is relaxed.

Process-local fixed windows and finite key stores retain the reviewed restart/eviction/shared-exhaustion limitations. Host is 36 GiB rather than the specified 16 GiB reference tuple; even passing local targets do not qualify the application. Workload receipt/trend/attention integration, API compatibility consumers, manual accessibility/ASVS evidence, independent implementation review, unsigned core mechanisms and host/human/release gates remain open. Requirement dispositions remain unaccepted.
