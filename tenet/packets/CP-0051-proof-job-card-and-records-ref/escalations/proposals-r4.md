# CP-0051 · Round 4 fixture questions

The independent conformance suite in `pkg/conformance/card/` tests the agreed rules of `contracts §5` (`tenet/specs/tech-spec/contracts.md:83–84`), `CI §1–§4` and `§10` (`tenet/specs/tech-spec/ci.md:9–101`, `253–269`), `ALG-07` (`tenet/specs/tech-spec/algorithms.md:148–150`), `ALG-14` (`tenet/specs/tech-spec/evidence.md:39–43`), and `CP-0051` (`tenet/specs/plan/alpha.0b.md:65–85`). The following details are not pinned by the specification and are left unconstrained in `expected.json` / `expected.md` until decided:

1. **Header commit vs. `evaluation_id` in `renderCard(model)` (`contracts.md:83–84`, `ux-spec.md:102`, `ci.md:84`).** `contracts §5` line 84 says section 1 of the card renders `evaluation_id`, tested commit (`merge-candidate` or `head`), and `badge` (`advisory` in alpha.0), while the UX sample at `ux-spec.md:102` shows `### Tenet proof · 9b41d0 (merge candidate) · advisory` (a 6-char commit prefix without the 16-char `evaluation_id`, or using a shortened ID) and `ux-spec.md:115` writes `"advisory · intent not yet blessed"` whereas `proof-card.json` has `badge: "intent-not-yet-blessed"` as a single enum value. Pin the exact header template for all three `badge` enum values (`advisory`, `verified-on-ci`, `intent-not-yet-blessed`) and both `tested.kind` values (`merge-candidate`, `head`).
2. **Byte-level Markdown grammar for sections 2–9 of `renderCard(model)` (`contracts.md:84`, `ux-spec.md:101–111`, `ci.md:83–99`).** UX Part 1A lines 101–111 gives one sample card, and `CI §4` gives prose descriptions of the nine sections, but the exact line templates for:
   - collapsed `same-area` requirements when more than one requirement shares an area,
   - `blessings_changed` (`doc`, `section`, `blessed_by`, `commit_author`),
   - `deltas` (`doc`, `added`, `modified`, `removed`),
   - `weakening.by` and `weakening.not_checked`,
   - `why[]` (`checked`, `judge`, `host`, `not-tenet`) and `degraded[]`,
   - malformed acceptance block errors (`TN-ACC-MISSING-ID` / `TN-ACC-DUP-ID`) on the card
   are not specified as exact templates. Pin the line-by-line templates so `expected.md` can switch from `"fragments"` to exact byte-for-byte Markdown.
3. **Always-populated vs. triggered `rules[]` and `why[]` arrays in `proof-card.json` (`contracts.md:84`, `algorithms.md:148–150`).** Does `card.rules` list all five rules on every evaluation (with `would_block: false` and a default `reason` when passing) or only rules where `would_block: true`? Likewise, what are the exact `why[]` entries emitted on a clean pass versus a degraded run?
4. **Canonical `degraded[]` strings for each `CI §10` degraded row (`ci.md:258–266`, `contracts.md:84`).** `CI §10` names the card phrases `"not checked"`, `"check failed after its tests passed"`, `"results not kept"`, and `"previous policy is used and named"`. What exact strings go into `card.degraded[]` for each of those rows?
