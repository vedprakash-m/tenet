# ALG-14 · Requirements a change touches

Materialize `base` and `head` as two successive Git snapshots. Each map is the complete snapshot. The review harness may write these to a temporary repository, preserving bytes. Invoke `touched(baseCommit, headCommit, implementsIds)` there and compare the ordered result. A negative case can name a valid lower-priority reason when it rules out a false positive.

Each case directory contains `input.json` and `expected.json`. Inputs and expected projections follow [the algorithm](../../../tenet/specs/tech-spec/algorithms.md#alg-14) and [contracts §§1 and 3](../../../tenet/specs/tech-spec/contracts.md#1-files-and-identifiers). See [independent fixtures](../INDEPENDENT.md).

| Case | Kind | Algorithm step or contract rule |
|---|---|---|
| [p01-implements-first](p01-implements-first/input.json) | positive | First reason wins, explicit implements ahead of overlapping citation |
| [p02-overlapping-replacement](p02-overlapping-replacement/input.json) | positive | Old-side replacement intersects cited range |
| [p03-interior-insertion](p03-interior-insertion/input.json) | positive | Pure insertion strictly before cited end |
| [p04-text-changed](p04-text-changed/input.json) | positive | Detect altered requirement text in a blessed section |
| [p05-same-folder](p05-same-folder/input.json) | positive | Top-level folder fallback without CODEOWNERS |
| [p06-codeowners-priority](p06-codeowners-priority/input.json) | positive | Use highest-priority CODEOWNERS file and its last matching rule |
| [p07-same-area-cap](p07-same-area-cap/input.json) | positive | Numeric sort precedes same-area cap of ten |
| [p08-deleted-document](p08-deleted-document/input.json) | positive | Read blessed requirements from base for deleted documents |
| [n01-draft-implements](n01-draft-implements/input.json) | negative | Draft requirement excluded despite explicit Implements |
| [n02-outside-replacement](n02-outside-replacement/input.json) | negative | Unchanged range does not receive cited-code-changed |
| [n03-insertion-at-end](n03-insertion-at-end/input.json) | negative | Insertion after the final cited line only counts as same area |
| [n04-same-owner-different-rule](n04-same-owner-different-rule/input.json) | negative | An equal owner does not make distinct patterns the same area |
| [n05-missing-implements](n05-missing-implements/input.json) | negative | Unknown Implements ID does not synthesize a requirement |
