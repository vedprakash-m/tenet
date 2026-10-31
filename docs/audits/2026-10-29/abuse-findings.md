# Additive abuse protection — October 29, 2026

Status: ◐ local, uncommitted, unqualified. This repairs an existing control promise; it does not approve a new legitimate-user admission policy.

The sign-in route configures five attempts/minute per IP/account. The installed rate plugin treats that configuration as a replacement for its default IP limiter. Consequently, after exhausting the default 120/minute IP budget, sign-in still reaches verification of a new account key. With a presented session and a held SQLite writer, it reaches maintenance and returns 503 instead of being rejected at admission. Three real application tests reproduce two failures plus a passing account-limit control.

Recipe `ts-web-api@0.3.3` now calls the plugin's `createRateLimit` API from an early request hook for the existing IP ceiling, while the account route retains its check. The ordinary `rateLimit` hook cannot simply be stacked: it sets the plugin's shared “already checked” marker and skips the later account check. A scratch mutation demonstrates that failure. Values, hashing work/concurrency, cookie/session/CSRF rules, public problem DTOs and quota/retry/correlation headers remain. An exhausted IP is rejected before body/session/hash work; forwarded headers do not supply a trusted IP. New accounts and separate network IPs retain their existing independent account budgets.

The new test file ships in the recipe; existing generated applications are not automatically rewritten. Dependency and lock bytes are unchanged. No kernel state/port/authority/budget changes are involved. One payload test file is added (84 files total).

## Browser failure retained and resolved

The unchanged shared development-UI cohort exhausts the IP counter at request 121. The API correctly returns 429 and the browser correctly displays recovery; this is recorded rather than bypassed. The browser fixture now builds the current production UI into a new owned directory and serves that bundle through the same-origin preview proxy with the real source API and allocated port/token. It does not reuse workspace output or change limits, credentials, assertions, skips or retries. This also tests the shipping UI rather than development-only duplicate effect execution. Output/cache is removed on fixture exit. All 85 evolved app and 15 browser assertions pass through the source feature loop; final full and built-CLI results are bound in [abuse-validation.json](abuse-validation.json).

## Performance remains open

A full post-repair Node 26.3 workload, run alone, still fails: 9,235 rate refusals from 9,440 operations, only 205 successful samples against 5,000, and 324,616,192-byte peak server RSS against 300,000,000. Event-loop p95 is about 12.19 ms; no duplicate active items/FK violations, and cleanup succeeds. Required burst/hash/busy coverage remains incomplete. [Actual report](abuse-reference-observation.json). No post-repair minimum-runtime full performance run or reference-tuple qualification is claimed.

[Pre-repair memory diagnosis](memory-diagnosis.md) explains observed hashing-correlated RSS spikes and runtime heap headroom without forcing GC or weakening cryptography. Its instrumented observations are separate from current-artifact performance. Neither an allocator diagnosis nor a memory repair is claimed.

Next: review a concrete authenticated-user/NAT admission contract while retaining anonymous/sign-in abuse controls; evaluate memory/runtime capacity options without weakening password work; then collect sufficient successful reference traffic before closing workload targets. Kernel workload receipt/trend/threshold-attention consumers, API/trait/changed-journey consumers, ASVS/manual evidence, unsigned core mechanisms and separately authorized native/release qualification remain open. The evidence ledger remains unaccepted. No commit or push.

## Final validation and remaining review

Final isolated CI passes 1,237 tests/202 suites with zero failures/skips. Both Node 26.3/22.12 pass 149 actual built-CLI UAT scenarios and the full 85-app/15-browser feature loop, retaining 59/11 neutral cases. Dependency/lock and kernel bytes are unchanged; the 84-file payload and final source identity are recorded in the validation JSON.

The initial concurrent CI run failed one unchanged Git-hook success case using a 1000 ms commit timeout. Its old assertion did not capture the adapter outcome, so the cause is unconfirmed. Three isolated repetitions and the full isolated rerun pass with exactly the same deadline/condition. Only outcome diagnostics were added to the assertion; no Git production code or timing cap changed. Keep this intermittent-load investigation open instead of claiming it eliminated. The validation record preserves the first failure and proves the sole source difference after workload/UAT is that diagnostic message.

The new admission-policy draft is separate and unsigned. The owner authorized one read-only independent review, which found two majors and one minor. All findings are now dispositioned and independently verified in [the review record](admission-review.md), with no remaining blocker/major design finding. Final owner sign-off is still pending; none of the proposed new quotas or session mechanisms is implemented.
