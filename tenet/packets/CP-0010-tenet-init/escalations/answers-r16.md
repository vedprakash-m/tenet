# Answers — CP-0010 round 16

Ruling on the open specification question raised by `origin/r9/cp-0010` (`5df814f`).

1. **`kit_sha256` line-ending normalization (`contracts.md §§1, 11`; `onboarding.md §2`; `src/core/hash.ts:15-19`, `src/policy/kit.ts:100-106`, `src/install/writes.ts:116-122`)**
   - **Decision:** Normalizing line endings to LF before hashing each file under `kit/` (`<path>\0<sha256>`) is **right and safe**, with one invariant on `kit/` contents:
     - All files under `kit/` are UTF-8 text (`kit/` contains no binary assets). Under cross-platform Git checkouts (for example `core.autocrlf=true` on Windows vs. LF in POSIX checkouts and Git tree blobs read by `catFileBatch`), unnormalized byte hashing causes spurious `TN-KIT-EDITED` / `TN-LOCK-MISMATCH` errors between `tenet init`, `examples/starter/tenet.lock`, and `tenet doctor` / `tenet check`.
     - Extending `contracts.md §11` (`Normalize CRLF to LF before hashing text`) to `kit_sha256` ensures identical digests across working trees and Git object stores on Windows, Linux, and macOS.
     - **Tamper safety:** No semantic or visible edit (characters, tokens, keys, whitespace indentation, added/removed lines, or file renames) can hide behind line-ending normalization; only differences between `\r\n`, standalone `\r`, and `\n` collapse. Because `kit/` is strictly UTF-8 text and `kitDigest` uses the same `sha256Text` normalization in both `src/install/writes.ts:118` and `src/policy/kit.ts:104`, any real modification to a kit file still fails `kit_sha256` verification. If binary assets were ever added to `kit/` in the future, `kit_sha256` would need explicit binary vs. text classification before hashing; until then `kit/` remains UTF-8 text only.
   - **Applied to:** `tenet/specs/tech-spec/contracts.md §1` (`tenet.lock` row).

2. **Platform-specific outside-repository writes (`onboarding.md §2`; `answers-r14.md §1`; `test/install/cli.test.ts:279-319`)**
   - **Confirmation:** Outside-repository local host edits apply **only on Windows (`win32`)** for hosts requiring a `cmd /c` MCP shim (`~/.claude.json`, `%APPDATA%/Cursor/User/mcp.json`, `%APPDATA%/Code/User/mcp.json`). POSIX hosts (`linux`, `darwin`) must produce `local_keys: []` and write nothing outside the repository even when `--local-hosts` is set; testing all three platforms via injected `environment.platform` and an isolated `localProfileRoot` matches the specification.
