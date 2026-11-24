# Owner adjudication — CP-0039 round 5 (2026-11-24)

After 5 review rounds (`L-0038` round cap reached on `shape/cp-0039`), the Owner adjudicated all remaining Round 5 findings on **2026-11-24**: **ACCEPT ALL FIVE**, with the exact edits specified below and nothing else.

## Adjudicated rulings

1. **GPT F1 (check requiredness & applicability):**
   - Only an indicator that **applies** to the change (applicability resolved on pinned facts per `R-204` and `ALG-07`, matching touched paths or declared dependencies per `R-202`) AND is in effective `enforce` mode can make its consumed report mandatory; the lane requiring the check itself (`lane_checks`) also makes it mandatory.
   - Genuinely unknown applicability stays visible (`TN-GATE-UNKNOWN`).
   - Add GPT's two fixtures to `AB-1`: (a) a docs-only change where the `payments` report is absent and the change passes, and (b) a deleted declared dependency where the same missing report fails.

2. **GPT F2 & MAI F1 (`touched_lines` paired hunk enforcement):**
   - `touched_lines` finding-set comparison stays at most `advise` in `CP-0039` core; per-file (`touched_files`) and per-area (`area`) enforcement stay.
   - Move paired old/new hunk enforcement and its base-side occurrence input contract to split packet **`CP-0065-paired-hunk-finding-ratchet`** (`blocked_by: [CP-0039]`), preserving both critics' Round 5 texts verbatim in its stub.
   - Remove the `"harmless edit inside paired range"` enforcement fixture from `AB-5` (keep `touched_lines` advisory-only).

3. **GPT F3 (raw LCOV & Cobertura vs metadata-verified `enforce`):**
   - Raw `lcov` and `cobertura` coverage is **advisory only** (`advise` cap): normalized, shown with its missing metadata named, and kept for trends, but **never earns gate credit**.
   - Tool identity (`tool.name`, `tool.version`, `tool.config_digest`) comes from the check's declaration in `<base>` `tenet.yaml`, never copied from the report or baseline.
   - Only `tenet-health-json` and `sarif` reports carrying the required metadata can be enforced.
   - Add GPT's plain-LCOV and plain-Cobertura positive goldens to `AB-3` with their gate eligibility explicitly stated.

4. **GPT F4 (observable `R-176` omissions in core vs silent omission):**
   - Limit `AB-6` to omissions the core can observe: declared partial coverage (`complete: false`), a missing expected module, or an unknown edge endpoint.
   - Give the omission fixture an observable incomplete marker, carry silent-omission detection to `CP-0064`, and explicitly state that the core verdict rests on the admitted report within `ci.md §5`'s honest limit.

5. **GPT F5 (should — `R-203` below-verify waiver rule):**
   - Health waivers follow `R-203` as written, including a labelled self-waive (`self-waived`) below `verify`.
   - Include both level outcomes (`verify`/`assure` self-waive refusal vs below-`verify` labelled `self-waived`) in `AB-7`.

## Closing pass rule

The shaping cycle finishes with a **verification-only pass** on `CP-0039` `definition.md` `version: 6` in which each critic (`GPT`, `MAI`) confirms **only its own Round 5 blockers** (`GPT`: `F1`–`F4` plus check on `F5`; `MAI`: `F1`).
