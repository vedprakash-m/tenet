# ASVS 5.0.0 Level 1 applicability

**Not ASVS conformance.** This initial inventory accounts for all 70 Level 1 IDs in the official v5.0.0 English release. Existing tests are verification starting points, not whole-requirement results. No requirement is marked passed. A dependency scan, a file's presence or this inventory's completeness test cannot establish conformance.

Source: [OWASP ASVS v5.0.0 English flat JSON](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.flat.json). Exact downloaded source SHA-256: `8201b20eec2908c3380ac600c91c8ba746346fbb808859366abb232027532311`. Rows select the source's `L = 1`, not Level 2/3 requirements. Topics below are short navigation labels, not replacement requirement text; use the linked standard for the full verification conditions.

## Scope and recording results

Scope is the neutral, development-only account platform, same-origin browser shell and loopback API. The generated loan example and future features require their own updated applicability/results; none is covered by this table automatically. `docs/hardening.md` states the local boundary and known deployment/identity limitations.

- `pending`: the method is identified, but a full requirement-specific review/observation has not been recorded. Linked behavioral cases may prove only part of the requirement.
- `gap`: current code or declared local behavior is insufficient for the full requirement. This is not a waiver or a passing result.
- `not-applicable`: the named capability is absent from this scope, based on the referenced source boundary. This is a scoped source review, not independent security approval; revisit it when capabilities or exposure change.

For each applicable row, run the named behavioral checks and perform the remaining manual procedure against the exact artifact. Record date, artifact/source identity, method, observed result and remaining conditions. Manual work includes source and browser inspection; networked TLS/certificate verification belongs to an explicitly authorized deployment environment, not this local fixture. Record failures as failures, not non-applicability. Independent review, owner disposition and qualification remain outstanding.

## Complete Level 1 inventory

| ID | Topic | Applicability | Method | Result | Evidence or reason |
|---|---|---|---|---|---|
| V1.2.1 | Contextual response encoding | applicable | behavioral+manual | pending | Inspect React text/attribute rendering and JSON serialization in `web/src/App.tsx` and `shared/schemas.ts`; add hostile-value browser cases. |
| V1.2.2 | Safe dynamic URLs | applicable | behavioral+manual | pending | Fixed same-origin paths in `web/src/lib/api.ts`; inspect every future path/query builder and allowed protocol. |
| V1.2.3 | JavaScript and JSON encoding | applicable | behavioral+manual | pending | Shared response serialization and client parsing in `shared/schemas.ts` and `web/src/lib/api.ts`; inspect any script embedding. |
| V1.2.4 | Parameterized database access | applicable | behavioral+manual | pending | Inspect every query in `server/src/platform/users.repository.ts` and `server/src/platform/session/sessions.repository.ts`; add adversarial query-value cases. |
| V1.2.5 | Safe OS command arguments | applicable | manual | pending | Review package scripts and `server/src/server.ts`; no HTTP handler currently launches commands, but future tools require argument-boundary review. |
| V1.3.1 | Untrusted rich HTML | not-applicable | source-review | not-applicable | No rich-text input or HTML upload/editor exists in `web/src/App.tsx`; adding one requires sanitization review. |
| V1.3.2 | Dynamic execution | applicable | manual | pending | Review application and build paths for dynamic execution; ordinary rendering in `web/src/App.tsx` does not prove absence across dependencies. |
| V1.5.1 | XML parser restrictions | not-applicable | source-review | not-applicable | No XML input/parser endpoint is registered by `server/src/app.ts`; new parsers reopen applicability. |
| V2.1.1 | Documented validation rules | applicable | manual | pending | `shared/schemas.ts` defines API structures and ranges; review documentation coverage and every business/security input. |
| V2.2.1 | Positive input validation | applicable | behavioral+manual | pending | Request-shape cases in `server/test/platform.test.ts` and schemas in `shared/schemas.ts`; review boundary and decision-making inputs. |
| V2.2.2 | Trusted validation layer | applicable | behavioral+manual | pending | Server Zod validation in `server/src/app.ts` and `server/test/platform.test.ts`; bypass the UI for all sensitive API cases. |
| V2.3.1 | Expected flow ordering | applicable | behavioral+manual | pending | CSRF/session/password controls in `server/test/platform.test.ts`; review omitted, reordered, replayed and concurrent flow steps. |
| V3.2.1 | Correct browser response context | applicable | behavioral+manual | pending | Header cases in `server/test/platform.test.ts`; inspect JSON/HTML/content sniffing and direct navigation for each served resource. |
| V3.2.2 | Text rendered as text | applicable | behavioral+manual | pending | React account output in `web/src/App.tsx`; verify attacker-controlled text renders inertly in every affected browser context. |
| V3.3.1 | Secure prefixed cookies | applicable | manual | gap | `server/src/platform/auth/routes.ts` uses unprefixed cookie names and HTTP development cookies without Secure; local identity scope is not full compliance. |
| V3.4.1 | HSTS policy | applicable | behavioral+manual | pending | Helmet is registered in `server/src/app.ts`; verify effective policy on every response and intended HTTPS deployment, not just header presence. |
| V3.4.2 | CORS origin restrictions | applicable | behavioral+manual | pending | Same-origin client in `web/src/lib/api.ts`; verify no permissive origin reflection or sensitive cross-origin responses at API and UI boundaries. |
| V3.5.1 | CSRF enforcement | applicable | behavioral+manual | pending | Session/pre-session token controls in `server/test/platform.test.ts`; inspect every mutation and browser-origin boundary. |
| V3.5.2 | Preflight-based CSRF | not-applicable | source-review | not-applicable | No preflight-only CSRF defense: `server/src/app.ts` requires explicit bound tokens for state-changing requests. |
| V3.5.3 | Sensitive HTTP methods | applicable | behavioral+manual | pending | Auth mutations use POST in `server/src/platform/auth/routes.ts`; GET session maintenance still writes timestamps and needs an effects review. |
| V4.1.1 | Accurate content types | applicable | behavioral+manual | pending | JSON error checks in `server/test/logging.test.ts`; verify charset and media type for every API/UI success and error body. |
| V4.4.1 | WebSocket TLS | not-applicable | source-review | not-applicable | No application WebSocket endpoint in `server/src/app.ts`; Vite development HMR is tooling, not a qualified network service. |
| V5.2.1 | Bounded file acceptance | applicable | behavioral+manual | pending | Operator-selected backup files enter `server/src/platform/restore.ts`; review size/resource limits independently of the HTTP body limit. |
| V5.2.2 | Accepted file content | applicable | behavioral+manual | pending | SQLite backup/history validation in `server/test/restore.test.ts` and `server/test/schema-history.test.ts`; inspect malformed/type-confused inputs. |
| V5.3.1 | Public file execution | not-applicable | source-review | not-applicable | No uploaded/untrusted generated files are served from a public application folder by `server/src/app.ts`. |
| V5.3.2 | Trusted file paths | applicable | behavioral+manual | pending | Operator database/backup paths in `server/src/platform/config.ts` and `server/src/platform/restore.ts`; review aliases, links and containment. |
| V6.1.1 | Documented abuse controls | applicable | manual | pending | `docs/hardening.md` describes finite per-process/IP/user budgets and denial limits; review malicious lockout and operational response. |
| V6.2.1 | Password minimum length | applicable | behavioral+manual | pending | `shared/schemas.ts` sets 12 (above L1's mandatory 8; L1 strongly recommends 15); `server/test/platform.test.ts` checks 11/12 and maximum boundaries; verify every creation/replacement path and disposition the recommendation. |
| V6.2.2 | Password change available | applicable | behavioral+manual | pending | API change/rotation case in `server/test/platform.test.ts`; the account UI has no password-change form, so user-facing usability needs review. |
| V6.2.3 | Current and new password | applicable | behavioral+manual | pending | `server/test/platform.test.ts` and `server/test/auth-freshness.test.ts` exercise authenticated replacement; inspect missing/incorrect current-password cases. |
| V6.2.4 | Common-password rejection | applicable | manual | gap | `server/src/platform/auth/routes.ts` hashes schema-valid replacements without a common-password blocklist; no qualifying dictionary/check exists. |
| V6.2.5 | No composition restrictions | applicable | behavioral+manual | pending | `shared/schemas.ts` sets length, not character classes; `server/test/platform.test.ts` checks case, numeric, punctuation, whitespace and Unicode examples; manual review remains. |
| V6.2.6 | Masked password input | applicable | behavioral+manual | pending | Password field in `web/src/App.tsx` uses password type; inspect all current and future password/confirmation surfaces. |
| V6.2.7 | Paste and password managers | applicable | behavioral+manual | pending | Autocomplete is present in `web/src/App.tsx`; exercise paste, browser helpers and an external manager, not markup alone. |
| V6.2.8 | Exact password verification | applicable | behavioral+manual | pending | `server/test/platform.test.ts` checks exact Unicode current/new passwords through password change and sign-in, and case, trailing-space and Unicode-normalization differences against scrypt; inspect every remaining credential path manually. |
| V6.3.1 | Implemented abuse defenses | applicable | behavioral+manual | pending | Real limit/boundary controls in `server/test/admission.test.ts` and `server/test/abuse-limits.test.ts`; compare behavior with documented policies. |
| V6.3.2 | No default accounts | applicable | manual | gap | `server/src/platform/dev-identities.ts` creates named development accounts with random secrets; production skips seeding, but the development profile is not full compliance. |
| V6.4.1 | Initial secret lifecycle | applicable | manual | gap | Random development passwords in `server/src/platform/dev-identities.ts` have no first-use expiry/mandatory replacement; do not describe them as compliant initial secrets. |
| V6.4.2 | No hints or secret questions | applicable | source-review | pending | Inspect `server/src/platform/auth/routes.ts` and `web/src/App.tsx` for absent hints/questions; verify every future recovery path retains this absence. |
| V7.2.1 | Backend token verification | applicable | behavioral+manual | pending | Forged/expired session controls in `server/test/platform.test.ts` and `server/test/auth-freshness.test.ts`; verify every protected route. |
| V7.2.2 | Dynamic session tokens | applicable | behavioral+manual | pending | `server/src/platform/session/session.ts` creates per-session random reference tokens; inspect lifecycle and all alternative authentication paths. |
| V7.2.3 | Reference-token entropy | applicable | behavioral+manual | pending | Session IDs use 32 CSPRNG bytes in `server/src/platform/session/session.ts`; review randomness, representation and token leakage. |
| V7.2.4 | Rotate on authentication | applicable | behavioral+manual | pending | Sign-in/password rotation cases in `server/test/platform.test.ts`; review every re-authentication path and concurrent writer outcome. |
| V7.4.1 | Terminated sessions unusable | applicable | behavioral+manual | pending | Expiry/sign-out/password revocation cases in `server/test/platform.test.ts` and late-auth controls in `server/test/auth-freshness.test.ts`. |
| V7.4.2 | Account removal invalidates sessions | applicable | behavioral+manual | pending | Deleted-user sign-in race in `server/test/auth-freshness.test.ts`; separately verify every pre-existing session after account removal. |
| V8.1.1 | Documented access policy | applicable | manual | pending | Actor boundary in `server/src/platform/actor.ts` and `docs/architecture.md`; add an explicit endpoint/object permission inventory with each feature. |
| V8.2.1 | Function authorization | applicable | behavioral+manual | pending | Actor/password/sign-out cases in `server/test/platform.test.ts`; enumerate and probe every function and role, including anonymous calls. |
| V8.2.2 | Object authorization | applicable | behavioral+manual | pending | Current-user derivation in `server/src/platform/auth/routes.ts`; the generated loan example needs its own object/borrower-denial results. |
| V8.3.1 | Trusted authorization layer | applicable | behavioral+manual | pending | `server/src/platform/actor.ts` and `server/src/app.ts` enforce backend authority; UI state is not authorization. |
| V9.1.1 | Self-contained token integrity | not-applicable | source-review | not-applicable | Only signed reference-session IDs in `server/src/platform/session/session.ts`; no self-contained claims/JWT acceptance exists. |
| V9.1.2 | Token algorithm allowlist | not-applicable | source-review | not-applicable | No self-contained token algorithm negotiation exists in `server/src/platform/session/session.ts`; reference cookies use fixed HMAC. |
| V9.1.3 | Trusted token key sources | not-applicable | source-review | not-applicable | No self-contained token issuer/key URL/header processing in `server/src/platform/session/session.ts`; keys come from validated local configuration. |
| V9.2.1 | Self-contained token validity | not-applicable | source-review | not-applicable | No self-contained validity claims are accepted by `server/src/platform/session/session.ts`; database reference-session expiry remains applicable under V7. |
| V10.4.1 | OAuth redirect registration | not-applicable | source-review | not-applicable | No OAuth authorization server or redirect grant endpoint is registered in `server/src/app.ts`. |
| V10.4.2 | One-use OAuth codes | not-applicable | source-review | not-applicable | No OAuth authorization-code/token exchange exists in `server/src/app.ts`. |
| V10.4.3 | OAuth code expiry | not-applicable | source-review | not-applicable | No OAuth authorization-code issuance exists in `server/src/app.ts`. |
| V10.4.4 | OAuth grant restrictions | not-applicable | source-review | not-applicable | No OAuth client/grant registration or token endpoint exists in `server/src/app.ts`. |
| V10.4.5 | OAuth refresh replay | not-applicable | source-review | not-applicable | No OAuth refresh-token endpoint or public-client grant exists in `server/src/app.ts`; session rotation is a different mechanism. |
| V11.3.1 | Safe cipher modes/padding | not-applicable | source-review | not-applicable | No application encryption/padding operation in `server/src/platform/auth/passwords.ts` or `server/src/platform/session/session.ts`; scrypt/HMAC are not encryption. |
| V11.3.2 | Approved ciphers | not-applicable | source-review | not-applicable | No application cipher selection in `server/src/platform/auth/passwords.ts` or `server/src/platform/session/session.ts`; future encryption needs review. |
| V11.4.1 | Approved cryptographic hashes | applicable | behavioral+manual | pending | scrypt/SHA-256 HMAC in `server/src/platform/auth/passwords.ts` and `server/src/platform/session/session.ts`; inventory all other cryptographic uses. |
| V12.1.1 | Modern TLS configuration | not-applicable | source-review | not-applicable | Only loopback HTTP is configured in `server/src/platform/config.ts`; no TLS listener/client or qualified network deployment is shipped. Reassess before shared use. |
| V12.2.1 | External HTTP uses TLS | not-applicable | source-review | not-applicable | No external-facing HTTP service or external HTTP client in `server/src/server.ts`; the declared listener is loopback-only, not production delivery. |
| V12.2.2 | Trusted public certificates | not-applicable | source-review | not-applicable | No external-facing TLS service/certificate in `server/src/server.ts`; adding a network boundary requires real certificate validation. |
| V13.4.1 | Source metadata inaccessible | applicable | behavioral+manual | pending | API routes in `server/src/app.ts` do not intentionally serve Git metadata; probe the API and Vite/static/proxy boundary and deployment artifact. |
| V14.2.1 | Secrets outside URLs | applicable | behavioral+manual | pending | Credential JSON and CSRF headers in `web/src/lib/api.ts`; inspect all callers, redirects, logging and browser history for query/path leakage. |
| V14.3.1 | Clear authenticated client data | applicable | behavioral+manual | pending | Successful sign-out clears account view in `web/src/App.tsx`; remote expiry, offline failure and cross-tab termination need separate observation. |
| V15.1.1 | Dependency remediation policy | applicable | manual | gap | `docs/hardening.md` records maintenance constraints but no complete owner/time-bound vulnerability remediation policy; obtain a stewardship disposition. |
| V15.2.1 | Dependencies meet policy | applicable | manual | pending | Pinned graph alone is insufficient; evaluate actual advisories/support dates against the adopted remediation policy before qualification. |
| V15.3.1 | Minimal data responses | applicable | behavioral+manual | pending | Shared response schemas and `server/test/openapi.test.ts` constrain account output; verify absence of every private field on all response/error paths. |

## Known gaps are not automatic product changes

Secure/prefixed cookies, short-lived initial credentials and default-account expectations conflict with claiming full Level 1 for the current development-only HTTP profile. The absent common-password check and stewardship policy need implementation or explicit requirement dispositions. Do not silently enable TLS, change the authentication policy, install a dictionary, remove required local identities or waive a standard to turn these rows green. Propose scoped changes with their tests and obtain the required review/sign-off.

Non-applicability expires when the corresponding capability appears. Update this inventory when adding a feature, parser, upload, token type, external connection, delivery environment or new security boundary. Keep completed behavioral/manual observations distinct from dependency scans and independent security review.
