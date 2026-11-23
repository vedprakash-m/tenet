# CP-0005 verification

- `npm run lint`: passed on 90 files.
- `node node_modules/typescript/bin/tsc --noEmit --allowImportingTsExtensions`: passed.
- `npm test -- test/core test/cli`: 32 passed.
- `npm test`: 53 passed, 2 pending from CP-0004, 0 failed.
- `npm run check:examples`: 6 YAML fences checked across 6 specification files.
- `npm pack`: 56 entries, 245,742 unpacked bytes; SHA-1 `91b0ed31b31a62592ff507406103816c2fafa338`.
- The exact release-workflow verification passed: it checked package version, required and forbidden entries, installed the tarball in an isolated folder, matched `npx tenet --version`, and asserted the complete SDK export list.
- CP-0005 fixtures: 4 RFC 8785 vectors, monotonic same-millisecond ULIDs, one alias-collision extension, and a 1,500-blob batch.

The macOS and Linux proofs remain represented by the three-platform release and CI workflows.
