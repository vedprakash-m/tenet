# Starter production runtime and fixed statements

Status: **Independently reviewed exploratory draft; not ready for implementation sign-off.** October 31, 2026. Subsequent supported Node 24 measurements fail acceptance; the proposed combination is not an adequate runtime fix yet.
No runtime implementation is authorized by this document. Scratch measurements are candidates, not installed improvements or qualification.

## 1. Requirements and outcome

Address the current-runtime starter workload's memory failure without changing its application semantics or numerical targets. PRD QLT-05 owns declared workloads/fitness functions; QLT-12 owns starter identity/exposure/data-model preservation. Technical specification §12 and the reference-workload protocol remain authoritative. Supported Node 22/24 LTS lines require final validation; Node 26 remains the current-host regression runtime, not a replacement for Node 24.

The generated application can build and start a JavaScript production API using its existing locked TypeScript compiler and Node runtime. Repository operations reuse a finite set of prepared SQL statements per database connection but execute every read/write against the database at the original point, inside the original transaction where required. No rows, sessions, grants, passwords or authorization outcomes are cached.

Keep source development, existing browser/UI behavior, SQL history, backup/restore checks, HTTP contracts, crypto, rate limits, hash concurrency and all current workload targets unchanged. No new dependency, kernel mechanism, schema, reason/action vocabulary or budget change.

## 2. Evidence motivating the choice

The unchanged post-authority application fails the full Node 26 workload at 326,828,032-byte RSS; Node 22 passes one local observation at 298,844,160 bytes. Each has more than 8,700 successful operations and complete burst/sign-in/busy/invariant coverage.

Scratch alternatives on Node 26 with the same dataset, 30-second warm-up, 120-second measurement and 20-client concurrency:

| Candidate | Peak RSS | Result |
|---|---:|---|
| Finite statement reuse only | 313,704,448 | Memory target failed |
| JavaScript emission only | 306,085,888 | Memory target failed |
| Combined, first run | 292,421,632 | All local measured targets passed |
| Combined, repeat | 293,355,520 | All local measured targets passed |

Each Node26 candidate preserves twelve one-winner/four-conflict bursts, all 48 sign-ins, bounded busy degradation and database invariants. The statement candidate and combined source pass the existing 133 application tests/types/lint. This does not isolate a runtime allocator cause or prove equivalence of an installed build lifecycle. The combined trial needs supported-runtime acceptance, reviewed implementation, stronger preservation tests and final-artifact measurements on all declared runtimes. Hardware is not the specified reference tuple.

Exact commands, hashes and failed trials belong in `docs/audits/2026-10-31/return-memory-validation.json`. Raw reports stay in the current session's files.

**Supported Node 24 follow-up:** pinned Node 24.22.2 disproves acceptance of the combination. Unchanged source peaks at **403,046,400 bytes** with all traffic/hash/busy checks; the combined candidate peaks at **357,793,792 bytes**, has **44/48** successful sign-in probes and no observed operation busy degradation. Both memory values exceed the unchanged target. Both retain twelve correct bursts, no database invariant violations and owned cleanup. The candidate's additional failure causes are not yet isolated; do not label them scheduling noise, drop them or call the combination a fix. No second supported-runtime pass is claimed. [Exact follow-up](../docs/audits/2026-10-31/runtime-lts-validation.json).

**Diagnostic follow-up:** bounded probe categories now reproduce four **`signin-status-503`** refusals in a new isolated Node24 candidate workload: 358,596,608-byte RSS, 44/48 sign-ins, no operation busy responses. Source independently peaks at 402,784,256 bytes with all 48 sign-ins and four operation busy responses. Both retain twelve correct bursts and invariants/cleanup. This identifies the failed HTTP stage/status, not the Problem type, exact writer overlap or earlier run's root cause. Refused sign-ins are not operation busy evidence and all original acceptance failures remain. The diagnostic repair passes 134 current application cases and complete built loan journeys; the runtime candidate is still uninstalled and not ready for sign-off. [Exact diagnostic evidence](../docs/audits/2026-10-31/workload-diagnostics-validation.json).

**Allocation follow-up:** an isolated source profile observes heap total expanding from 38,125,568 to 163,250,176 bytes while a later used-heap sample is 20,721,488 bytes; this is not proof of an unbounded live-object leak. Hash-only four-way controls retain the exact scrypt parameters. Three distinct scratch replacements still fail Node24 memory: reusable immediate-transaction dispatcher **358,268,928 bytes** (profiled), precompiled default headers **355,041,280 bytes**, and bundled actual API **357,646,336 bytes**. The latter two also retain hash/busy failures. No candidate is selected or installed; cumulative allocation samples and instrumented RSS are diagnostic, not final-artifact acceptance. [Rejected experiments and limits](../docs/audits/2026-10-31/runtime-profile-validation.json).

## 3. Selected mechanism and affected surfaces

### Fixed statements

Add `server/src/platform/statements.ts`, a small typed factory taking only a module-owned fixed SQL dictionary. Each factory has a `WeakMap` keyed by the real `Db`; each connection's entries are bounded by that dictionary's keys. Prepare lazily on first use, cache only a successfully prepared statement, and execute `.get/.all/.run` with the current call's original bindings. Do not accept runtime SQL, expose a global query-string cache, change SQL text/order, retain database rows or hide driver errors.

Use it in the existing user/session repositories and the generated loan example's item/loan repositories. The four dictionaries currently total 21 statements per connection. Closing a database invalidates its statements as the driver normally does; a different connection, even to the same file, has its own set. Schema changes retain the driver's normal reprepare/error behavior. No connection-close override or cross-connection cache.

### Production artifact

Add a runtime-specific TypeScript project extending the current strict configuration, emitting only `server/src` and `shared` with `rewriteRelativeImportExtensions`. Use the existing TypeScript 5.9.3 dependency and NodeNext resolution. Output preserves the directory layout under `dist/api`, including `server/src/server.js`, `shared` and exact-byte copies of `server/migrations/*.sql`. SQL lookup relative to the emitted module then works without a new environment override. Native modules remain installed locked dependencies, not embedded or replaced.

Add a narrowly scoped server build script using existing Node/TypeScript tooling. Before work, invalidate its old owned API output so a failed build cannot silently leave a runnable stale artifact. Compile in an owned temporary directory under `dist`; copy only regular migration assets, require successful compiler completion and required output files, then atomically rename the completed directory to the stable API path on the same filesystem. Do not publish files individually. On failure remove only that invocation's temporary output and leave no usable API artifact. Builds are serialized; overlapping builds must explicitly refuse rather than publish mixed output. Do not delete or rewrite source, data, `.env.local`, `dist/web`, or unrelated output. Propagate errors.

`npm run build` produces the existing browser artifact plus the API artifact; `npm run build:server` produces only the API. `npm start` uses `node dist/api/server/src/server.js`; `npm run dev` stays source-based. `npm run restore` and source-derived OpenAPI stay source-based in this slice. An absent output makes `npm start` fail visibly; it does not rebuild automatically or fall back to source.

The generated loan manifest must retain these platform scripts while adding its workload scripts. Add its workload harness to a separate emitted tooling project or equivalent build stage: the full workload launches the actual built production entry and a built writer/observer, not source code or a duplicated app factory. Keep the source smoke diagnostic available and explicitly unqualified. Do not permit dataset, duration, concurrency or memory-flag overrides.

Update template README, hardening/runtime documentation and the loan workload guide. Keep compiled output ignored by the existing `dist` entry. Extend the explicit payload inventory and its tests when files are added; do not omit them to pass integrity checks.

## 4. Behavioral examples and test ownership

| Example / acceptance criterion | Test home |
|---|---|
| Repeated repository operations reuse one statement per fixed key/connection, not one per bound value; failed preparation is not cached. | Template `server/test/statements.test.ts` |
| Independent connections retain independent statements and observe external password/user-role/session deletion/touch and loan changes; writes still act on current state. No stale authority or row result is reused. | `server/test/statements.test.ts`, existing authority/password/session cases, loan `server/test/loan-authority.test.ts` |
| Closing a connection and using its repository still surfaces a driver error. Another connection works. A rollback changes no preserved rows; successful later reads are fresh. | `server/test/statements.test.ts` |
| Existing complete application suite, including five real return processes and stale authority/password races, retains its assertions; no changed status/DTO/crypto/quota. | Template/loan tests plus `packages/kernel/test/golden-task-loan-desk.test.ts` |
| A fresh build emits JavaScript and exact migrations without changing source bytes; API starts from the artifact on a new owned DB, runs its real routes, and closes. Browser output remains present. | Template `server/test/runtime-build.test.ts` |
| Missing/failed compiler, missing/linked migration asset, overlapping build or interrupted publication is an explicit failure and cannot start stale/partial output. Source/data/browser assets remain unchanged; next independent build succeeds. | `server/test/runtime-build.test.ts` |
| Built HTTP calls preserve authentication, CSRF, admission, account, validation/denial/conflict/persistence and OpenAPI contracts; compiled SQL history still refuses retroactive/missing migrations. | `server/test/runtime-build.test.ts`, real built starter/loan journeys |
| Full workload uses the actual built entry on supported Node 22/24 and the current Node 26 regression runtime, preserves every protocol/coverage check and cleanup, and records all runs including failures. Pin and record each exact runtime version. | Loan `server/test/workload.test.ts`, full retained workload reports |
| At least two independent final-artifact full observations on each of those three pinned runtimes pass the unchanged 300,000,000-byte RSS and other measured targets. If any fails, this slice remains incomplete; no forced GC, heap flags, weaker hashing or dropped samples. | Full workload reports bound to final source/artifact |

Tag new behavior controls with `[QLT-05]` for declared workload/fitness subclaims and `[QLT-12]` for actual starter identity/exposure/data-model preservation, not blanket runtime coverage. NFR-05 concerns Tenet active-time reporting, not this application's memory target, and is not claimed by this slice. A tag or local passing workload does not qualify a whole requirement.

## 5. State/contracts and compatibility

No kernel/private-state/SQL migration/API DTO/authority contract changes. Template tooling gains emitted runtime files and build/start behavior; document that users must build before production start. No deployment, public listener, artifact authenticity, packaged dependency restore or production hosting guarantee is added.

The stack adapter's existing type/static/browser controls must continue to run against source. The golden manifests, payload checks, `.gitignore`, README commands, browser/build callers and workload process launchers must be updated consistently. Do not claim kernel workload receipts/trend/attention consumers are implemented by this application build change.

## 6. Alternatives and recommendation

1. **Combined JavaScript production output and finite statement reuse (candidate, not recommended for installation yet):** existing dependencies and semantics; two promising Node 26 measurements but supported Node 24 still fails. Further replacement design and supported-runtime acceptance are required before selection, build lifecycle implementation and sign-off.
2. **Either component alone:** both failed the memory target; do not install one and claim completion.
3. **Runtime heap flags, forced GC, reduced hash cost or concurrency:** not selected. Would alter resource/security behavior or conceal peaks without solving the current specified workload.
4. **API bundler/new dependency:** not selected for this slice. Existing compiler is sufficient for the measured prototype; bundling introduces new module/asset/externalization behavior.
5. **Restrict runtime support to Node 22 or raise the memory target:** not selected; changes the required outcome rather than fixing it.

## 7. Risks, assumptions and gates

- Two local passes with approximately 6.6–7.6 MB headroom are not a general memory guarantee; final installed-code and repeated dual-runtime observations may fail.
- The prototype manually adjusted its compiled workload child filenames and copied migrations. Those actions are not a finished production build mechanism; implement/test the specified lifecycle before claiming equivalence.
- Reusing statement objects is safe only for fixed synchronous repository operations, not shared live iterators or dynamically configured statements. This slice uses no iterator or statement-mutating mode.
- Driver reprepare semantics must be verified against the locked SQLite driver and real schema/transaction controls.
- Development/browser/source controls do not replace actual built runtime tests.
- Compiler/build output and overlapping failure safety must not silently consume or discard human source/data.
- Each native host/human/reference-hardware/release campaign retains separate authorization. No installation, external spend or publication follows from this spec.

Independent review, disposition of every finding and owner sign-off precede runtime implementation. Then TDD, full CI, actual built UAT on the two supported LTS lines and the current-host regression runtime, repeated final full workloads, canonical documentation/plan/changelog/payload backfill and privacy checks. Keep all work on existing `main`, preserving inherited work. No commit or push without an explicit request.

## 8. Independent review dispositions (October 31)

One fresh-context read-only reviewer inspected this spec, relevant template/PRD source and the two changed five-process fixture files. No host, test or model campaign was performed by the reviewer.

| Finding | Disposition |
|---|---|
| Blocker: Node 24 is a supported LTS line but was absent from final-artifact acceptance. | Accepted. Require pinned Node 22, 24 and current-host Node 26 UAT and at least two final full workload observations each. Node 26 measurements do not substitute for Node 24. |
| NFR-05 does not own starter memory/runtime behavior. | Accepted. Remove its requirement claim/tag; retain QLT-12 and the unchanged canonical workload targets. |
| Make interrupted-publication safety explicitly atomic. | Accepted. Require same-filesystem completed-directory rename, never per-file publication. |
| Two five-process fixture changes. | No high-confidence bug or weakening found. Observer preserves real driver rows and original outcome/persistence assertions. This is review, not proof of remote-host root cause. |

The reviewer stated readiness for owner review after the blocker is dispositioned. All three findings are incorporated above. Subsequent Node 24 trial failures block the proposed acceptance: the design is not ready for implementation sign-off despite the completed document review. The owner was unavailable when asked; no explicit approval was supplied or inferred. Continue bounded investigation without installing the prototype or weakening its targets.
