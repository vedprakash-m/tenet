# ALG-03 · Citation anchors, flags and owner precedence

The `files` map backs `readFile`, with an absent key returning `null`. Compare the `anchorsFor` or `relocate` result directly. Compare `flags` with the output array. `owner` checks the semantic owner precedence described by ALG-03. Project the result to an ordered list of owner identifiers, preserving explicit CODEOWNERS handles. The contract does not name the function that integrates this owner lookup.

Each case directory contains `input.json` and `expected.json`. Inputs and expected projections follow [the algorithm](../../../tenet/specs/tech-spec/algorithms.md#alg-03) and [contracts §§1 and 3](../../../tenet/specs/tech-spec/contracts.md#1-files-and-identifiers). See [independent fixtures](../INDEPENDENT.md).

| Case | Kind | Algorithm step or contract rule |
|---|---|---|
| [p01-path-anchor](p01-path-anchor/input.json) | positive | Blessing path anchors and normalization |
| [p02-peer-test-anchor](p02-peer-test-anchor/input.json) | positive | Test range stops before the next peer declaration |
| [p03-doc-anchor](p03-doc-anchor/input.json) | positive | Document citation uses section digest and body |
| [p04-unique-relocation](p04-unique-relocation/input.json) | positive | Single moved anchor uses 1-based inclusive range |
| [p05-clean-moved-anchor](p05-clean-moved-anchor/input.json) | positive | Unique movement does not flag sources-changed |
| [p06-owner-precedence](p06-owner-precedence/input.json) | positive | Front matter beats CODEOWNERS and Owner |
| [p07-owner-last-match](p07-owner-last-match/input.json) | positive | Last matching CODEOWNERS rule wins |
| [n01-ambiguous-relocation](n01-ambiguous-relocation/input.json) | negative | Multiple matches do not choose a destination |
| [n02-missing-source](n02-missing-source/input.json) | negative | Deleted cited file flags sources-changed |
| [n03-edited-intent](n03-edited-intent/input.json) | negative | Edited is independent of citation integrity |
| [n04-unblessed-stale-metadata](n04-unblessed-stale-metadata/input.json) | negative | Unblessed sections do not get blessed flags |
| [n05-ambiguous-moved-anchor](n05-ambiguous-moved-anchor/input.json) | negative | Multiple moved locations flag changed sources |
