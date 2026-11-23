# ALG-02 · Section parsing, digests and rename matching

`parseDoc` compares only the supplied fields of each section. When `problem_codes` is supplied, compare the exact list of diagnostic codes. `sectionDigestMany` calls `sectionDigest` once per supplied body, in order. `parseRequirement` compares the returned record or the supplied diagnostic fields.

Each case directory contains `input.json` and `expected.json`. Inputs and expected projections follow [the algorithm](../../../tenet/specs/tech-spec/algorithms.md#alg-02) and [contracts §§1 and 3](../../../tenet/specs/tech-spec/contracts.md#1-files-and-identifiers). See [independent fixtures](../INDEPENDENT.md).

| Case | Kind | Algorithm step or contract rule |
|---|---|---|
| [p01-leading-preamble](p01-leading-preamble/input.json) | positive | Section boundaries and non-empty preamble |
| [p02-four-backtick-fence](p02-four-backtick-fence/input.json) | positive | Fence length and closing delimiter |
| [p03-unicode-and-empty-slug](p03-unicode-and-empty-slug/input.json) | positive | Unicode letters/digits and empty-slug ordinal |
| [p04-normalized-bodies](p04-normalized-bodies/input.json) | positive | CRLF, trailing spaces and line-only citation changes |
| [p05-rename-digest](p05-rename-digest/input.json) | positive | Single new section matching vanished slug digest |
| [p06-requirement-prefix](p06-requirement-prefix/input.json) | positive | Contracts §1/§3 custom prefix and nullable metadata |
| [n01-duplicate-slug](n01-duplicate-slug/input.json) | negative | Duplicate slug diagnostic |
| [n02-ambiguous-rename](n02-ambiguous-rename/input.json) | negative | Multiple possible renamed sections |
| [n03-missing-front](n03-missing-front/input.json) | negative | Contracts §3 missing front matter |
| [n04-invalid-origin](n04-invalid-origin/input.json) | negative | Contracts §3 rejects an invalid origin |
