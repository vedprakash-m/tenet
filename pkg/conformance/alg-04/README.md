# ALG-04 · Citation resolution

Parse `path` and `text` as the source document, then resolve citations with `files` as the reader. Missing files return `null`. Compare only `code`, `severity`, `rule` and `line` for each finding. Message and fix wording are outside this oracle.

Each case directory contains `input.json` and `expected.json`. Inputs and expected projections follow [the algorithm](../../../tenet/specs/tech-spec/algorithms.md#alg-04) and [contracts §§1 and 3](../../../tenet/specs/tech-spec/contracts.md#1-files-and-identifiers). See [independent fixtures](../INDEPENDENT.md).

| Case | Kind | Algorithm step or contract rule |
|---|---|---|
| [p01-single-line](p01-single-line/input.json) | positive | Inclusive single-line path |
| [p02-full-range](p02-full-range/input.json) | positive | Inclusive path range ending on last line |
| [p03-doc-heading](p03-doc-heading/input.json) | positive | Exact document slug resolves |
| [p04-nested-test](p04-nested-test/input.json) | positive | Nested title segments occur in order |
| [p05-python-test](p05-python-test/input.json) | positive | Python declaration segment resolves |
| [p06-go-test](p06-go-test/input.json) | positive | Go declaration segment resolves |
| [n01-missing-file](n01-missing-file/input.json) | negative | Absent source file diagnostic |
| [n02-backward-range](n02-backward-range/input.json) | negative | Reversed bounds diagnostic |
| [n03-missing-heading](n03-missing-heading/input.json) | negative | Missing document heading diagnostic |
| [n04-reversed-test-segments](n04-reversed-test-segments/input.json) | negative | Present test segments in reverse order do not resolve |
| [n05-out-of-range](n05-out-of-range/input.json) | negative | End is beyond the physical source line count |
