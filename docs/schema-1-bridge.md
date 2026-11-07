# Schema-1 bridge candidate

This is a separately reviewable schema-1 safeguard, not a schema-2 activation,
qualified host, tag or release. Schema-2 activation remains blocked until the
required hardened bridge is actually available and its exact artifact is pinned.
A source commit or green CI alone does not establish that release prerequisite.

## Store contract

Before protected writes and lock/recovery/maintenance boundaries, the bridge
admits the raw locally owned marker, primary and previous schema declarations.
Parsed missing, invalid, unknown or target-schema declarations refuse without
falling back to an older record. Duplicate decoded JSON keys also refuse.
Existing syntactically corrupt same-schema diagnostic recovery is unchanged.
Imported/copied stores still require the existing explicit quarantine path.

Either `.tenet/migration-transition.json` or `.tenet/migration-privacy.json`
blocks ordinary operation regardless of terminal metadata. Waiting transaction
writers re-admit; every writer re-admits after its exclusive lock claim.
Synchronous owned-store writers use the same `.tenet/lock`, refusing contention
with `kernel-busy` rather than waiting or breaking a stale lock. Nested writers
reuse only their operation's live lock context; retained Tx writers refuse after
release. No lock is held across an external job.

Read-only artifact inspection validates paths without creating directories or
changing permissions. Stateless advisory artifacts retain their unbound temp
behavior; blob writes cannot initialize an unowned store. Log/blob/residue
diagnostics also admit before exposing data. No Windows mutating capability is
added.

## Minimal terminal contract

`.tenet/migration-terminal.json` must contain exactly these five keys:

| Key | Value |
|---|---|
| `operationId` | 32 lowercase hexadecimal characters |
| `protocolVersion` | `1` |
| `versions` | Exactly `from` and `to`: `1` to `2`, or `2` to `1` |
| `outcome` | `upgraded` for `1` to `2`; `rolled-back` for `2` to `1` |
| `bindingDigest` | 64 lowercase hexadecimal characters |

The bridge accepts only `2` to `1` / `rolled-back`, with independent schema-1
ownership and no active fence. It preserves the terminal bytes. A terminal
never establishes ownership, grants recovery authority or permits replay.
No timestamp, owner, path, build identity, payload or extension key belongs in
this record. Digest shape is validated; the bridge does not certify that a
terminal's binding digest corresponds to a real migration.

Pure `core/migration-terminal.ts` exports `Terminal` and
`matchTerminal(stored, asked)`, comparing every fact. The filesystem adapter
exports `parseUniqueRecord(text)` (50 MiB and depth 64 bounds, duplicate decoded
key refusal), `readRecord(path)` (bounded regular-file, no-follow, stable UTF-8
read) and `readTerminal(path)` (those checks plus the strict terminal schema).
Ordinary `transaction(verb, callback)` has no future-descriptor recovery
exception. A future migrator must integrate explicitly authorized same-ID/facts
recovery at that shared lock/admission boundary, not bypass it.

## Reproduce and record identity

Use an inspected, clean checkout of the exact candidate commit and Node 24+
for source tooling:

```sh
git rev-parse HEAD
git status --porcelain
npm ci --ignore-scripts --no-audit
npm run ci
npm run uat
npm run verify:reproducible
```

The reproducibility verifier builds twice into independent empty output
directories, checks the complete payload inventory and every payload checksum,
and refuses changed build inputs or unequal outputs. It prints the actual
`kernelSha256`, `manifestSha256` (the complete `SHA256SUMS` bytes), `inputSha256`,
source commit/dirty flag and Node/esbuild/TypeScript versions. Require
`sourceDirty: false` for a committed candidate identity. The input digest
includes installed compiler files and is platform/toolchain-specific.

Preserve those actual results alongside the exact-head untrusted Ubuntu/macOS
CI and built-bundle UAT run URLs, including Node 22.12 minimum-runtime UAT.
Compare the built `plugin/kernel/tenet.mjs` and `plugin/SHA256SUMS` digests with
the verifier's output before proposing an artifact pin. This establishes
same-source/installed-toolchain reproducibility only, not reproducibility
across arbitrary environments, publisher authentication or release provenance.
Never substitute a digest from a dirty checkout or another commit.

Source tests exercise real competing/waiting writers and process interruption
with two restarts. Built UAT also interrupts a synthetic terminal publisher
under the actual bundle's lock. These controls test refusal and terminal/fence
ordering; they are not a schema-2 migration or an installed-host observation.
Installed-host behavior and power-loss durability remain unobserved.
