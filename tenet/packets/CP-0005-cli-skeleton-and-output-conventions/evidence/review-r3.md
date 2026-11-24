# Independent round 3 review · CP-0005

Reviewed `main` at `1729379` (after commit `7b8fd8e` / merge `ab82537` containing GPT's `src/core/hash.ts` fix) against `tenet/specs/plan/alpha.0.md:29–45` and `tenet/specs/tech-spec/contracts.md:15, 128, 160–180`.

| Contract field | Verdict | Evidence |
|---|---|---|
| Needs | met | `CP-0003` and `CP-0002` foundations and the referenced contract sections (`C §8, §11, §13; TS §1–§2; ALG-12`) are in place. |
| Owns | met | `src/cli.ts`, `src/sdk.ts`, `src/commands/index.ts`, `src/core/{fs,yaml,git,hash,output,clock}.ts`, `package.json`, `.github/workflows/release.yml`, `test/helpers/`, `test/core/`, and `test/cli/` match the contract. |
| Exports | met | All contracted CLI, FS, YAML, Git, hash (`sha256`, `jcs`, `ulid`, `alias`) and output (`result`, `fail`) exports are exposed from `src/sdk.ts:1–8`. |
| Behavior | met | The round 2 `jcs` finding is resolved: `src/core/hash.ts:42–53` (`canonicalString`) now rejects lone UTF-16 surrogates (`0xd800..0xdfff`) with `TypeError` (`code: "TN-SCHEMA"`) for both string values (`src/core/hash.ts:60`) and object property names (`src/core/hash.ts:76`). |
| Edge cases | met | Unpaired surrogates at start, middle, end, reversed surrogate pairs, valid astral pairs (`U+1F603`, `U+1D11E`), `NaN`, `undefined`, paths with spaces/Unicode, symlinks and atomic-write retries are tested. |
| Out of scope | met | No command business logic or alpha.2 signing is included. |
| Fixtures | met | `test/core/hash.test.ts:17–44` exercises RFC 8785 ordering, number formatting, control-character escaping, valid surrogate pairs and unpaired-surrogate rejection in values, nested arrays and keys. |
| Proving | met | `npm test -- test/core test/cli` passed (33/33); `npm pack` plus isolated installation in a temporary directory outside the repo verified `npx --no-install tenet --version` (`0.0.0`) and `import('@vedprakash-m/tenet')` (`typeof m.run === "function"`). Three-platform CI passed on PR #1 and PR #2 (`tenet/ledger/L-0036-round-2-merged.md:20–21`). |

## Findings

- **nit** · `src/core/hash.ts:47–49` and `:57` versus `tenet/specs/tech-spec/contracts.md:170` and `tenet/specs/tech-spec/messages.md:58`. `canonicalString` attaches `code: "TN-SCHEMA"` to the thrown `TypeError` without a `.fix` string, and non-finite number rejection throws a bare `TypeError` without `code` or `fix`. **Fix:** attach a `fix` property (or use a shared error helper) if `jcs` errors are surfaced directly to users.

## Proving on Windows

Ran on Windows (Node 24.22.1) against `1729379`:
- `npm run lint` and `npm run check:examples`: exited `0`.
- `npm test -- test/core test/cli`: exited `0` (`33 pass, 0 fail`).
- `npm pack` smoke test in a disposable temp folder: installed `vedprakash-m-tenet-0.0.0.tgz`, `npx --no-install tenet --version` printed `0.0.0`, and `node -e "import('@vedprakash-m/tenet')"` resolved `run` as a function.
