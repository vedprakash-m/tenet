# Budget trim · onboarding.md and ux-spec.md
## Summary
| File | Tokens before | Tokens after | % of 6,000 |
|---|---:|---:|---:|
| `tenet/specs/tech-spec/onboarding.md` | 5,517 | 4,797 | 79.95% |
| `tenet/specs/ux-spec.md` | 5,539 | 4,799 | 79.98% |

`node dist/cli.js check --json` exposed no budget finding or token count. I used Tenet's `specificationBody(text).length / 4` implementation, not a whole-file chars/4 script: onboarding 4,797 and UX 4,799.

## `tenet/specs/tech-spec/onboarding.md`
| Section (heading) | Tokens before | Tokens after | What was cut | Where it is still said |
|---|---:|---:|---|---|
| `_preamble` | 112 | 112 | None | same section |
| `1. Onboarding and blessing (R-223)` | 2,303 | 2,085 | Restored skipped-path, project-kind, instruction, card and blessing facts; shortened redundant prose | same section |
| `2. Install and upgrade` | 2,394 | 2,100 | Restored apply, remove and host facts; shortened repeated prose | same section |
| `3. Onboarding measures (ALG-13)` | 415 | 317 | Shortened kept, recall and invented definitions | same section |
| `4. Release procedure` | 211 | 175 | Restored release retry rule; shortened release steps | same section |

## `tenet/specs/ux-spec.md`
| Section (heading) | Tokens before | Tokens after | What was cut | Where it is still said |
|---|---:|---|---|---|
| Preamble | 170 | 150 | Restored required context where needed; shortened surrounding prose | same section |
| `Part 0: get Tenet` | 429 | 394 | Restored init-runner text; shortened repeated install prose | same section |
| `Part 1: start here` | 1,571 | 1,421 | Restored drafting citations and init wording; shortened repeated onboarding prose | same section |
| `Part 2: the daily loop` | 763 | 676 | Shortened card, review and board prose | same section |
| `Part 3: when you want more` | 456 | 364 | Restored risky-change examples; shortened rules and verification prose | same section |
| `Part 4: keeping Tenet current` | 261 | 237 | Restored mismatch and CI upgrade rules; shortened surrounding prose | same section |
| `Part 5: the agent's side` | 381 | 314 | Restored context rule; shortened host prose | same section |
| `Part 6: reference` | 985 | 797 | Restored badges and board.json rule; shortened principles and wording text | same section |

## Restored coordinator items
| File | Coordinator item | Final text retained |
|---|---|---|
| onboarding.md | 1. Skipped paths | `sources.files` retains `(kind: "test")`; test files are excluded only from `size.source_lines`. |
| onboarding.md | 2. Project kind | Restored all `cli`, `library`, `data` and `infrastructure` detection details, including `package.json`, `pyproject.toml`, `Cargo.toml`, `*.ipynb` and `apiVersion:` + `kind:`. |
| onboarding.md | 3. Instruction files | Restored `AGENTS.md outside Tenet's block`. |
| onboarding.md | 4. Onboarding card | Restored literal `"Sections (about <n> minutes)"` and its sum of section minutes. |
| onboarding.md | 5. Apply step 2 | Restored `manifest.blocks[]` for blocks, `manifest.keys[]` for keys, and preserving surrounding bytes including CRLF. |
| onboarding.md | 6. Remove rules | Restored report-first ordering, `.tenet/reports/` scope, `lstat` confinement without symlink traversal, and reporting every deleted working-state file in `removed`. |
| onboarding.md | 7. Release retry | Restored: if one package publishes and another fails, release is retried with the same version. |
| ux-spec.md | 8. Drafting origins | Restored `observed` citation duty (file and lines or test) and `documented` section citation duty. |
| ux-spec.md | 9. Careful lanes | Restored risky changes examples: authentication, data and payments. |
| ux-spec.md | 10. Badges | Restored "one badge per result". |
| ux-spec.md | 11. Context | Restored "Context always starts with global rules". |
| ux-spec.md | 12. UX-3 | Restored `board.json` and "the same facts". |
| ux-spec.md | 13. Upgrade | Restored `tenet check` mismatch reporting and M4 CI scheduled upgrade pull requests. |
| ux-spec.md | 14. Init without runner | Restored that `--yes` explains how to add one in `tenet.yaml`. |

## Sentences removed
For each removed sentence, the retained sentence or link carries the meaning.

| Section | Removed original sentence | Meaning retained |
|---|---|---|
| onboarding · preamble | “How a project gets Tenet, how its specifications are drafted and blessed, and how Tenet is upgraded and removed.” | “Project setup, drafting, blessing, upgrade and removal.” |
| onboarding · 1 | “`--inventory-only` stops there, writing … from `HEAD` …” | “`--inventory-only` writes … from `HEAD` …” in the same section |
| onboarding · 1 | “`dead-path`: doc paths and links that name missing files …” | The unchanged `dead-path` bullet and its `./`, `/…`, bare-name and `message` rules |
| onboarding · 1 | “Repository facts and `assignment.json` are byte-identical over `(HEAD, working tenet.yaml)`.” | The shorter same-section sentence “Repository facts and `assignment.json` are byte-identical over `(HEAD, working tenet.yaml)`.” |
| onboarding · 1 | “The target branch has no Tenet workflow yet.” | The same section's `CI cards begin after the setup merges` sentence |
| onboarding · 1 | “The draft format's other columns are kept and ignored.” | The shortened draft-format sentence immediately after it |
| onboarding · 1 | “`tenet check` resolves every citation (ALG-04) and flags statements without an origin.” | “`tenet check` resolves citations (ALG-04) and flags missing origins.” |
| onboarding · 1 | “The last blessed text stays in force” followed by a multi-clause explanation | The shortened “Last blessed text stays in force” paragraph |
| onboarding · 2 | “The `AGENTS.md` block (agents.md §1)” as an explanatory parenthetical | [agents.md](tech-spec/agents.md) in the host table and surrounding prose |
| onboarding · 2 | “A rerun after an interruption finds the pending file and completes remaining writes.” | “Recovery completes remaining writes.” |
| onboarding · 2 | “deletes text between markers (or restores `previous_block` / `prefix_sep` …)” | The shorter remove bullet in the same section |
| onboarding · 2 | “read any `.tenet/reports/` `checks[].report_path` entries …” | The shorter report-path/remove bullet in the same section |
| onboarding · 3 | “Adoptions (`inferred` -> `asked`) with unchanged text count in both `kept` and `adopted` …” | The shortened “Kept” bullet |
| onboarding · 3 | “Without `drafted_at_rev` (or if unreachable in a shallow clone after squash merge) …” | The shortened drafted-at-revision sentence |
| onboarding · 3 | “Recall: answer-key obligations matched by a kept or edited statement, judged by a human scorer.” | “human-scored answer-key obligations matched by a kept or edited statement” |
| onboarding · 4 | “A short-lived granular token may be used for the first publish of a new package.” | The trusted-publishing step's shorter equivalent |
| ux · preamble | “Get Tenet (Part 0), then follow the existing or new repository path to blessed specs (Part 1) and the daily loop (Part 2).” | “Get Tenet (Part 0), follow an existing/new repository to blessed specs (Part 1), and use the daily loop (Part 2).” |
| ux · Part 0 | “Git; a GitHub repository with Actions enabled (other forges later); Node 22 or later…” | “Git, GitHub Actions and Node 22 or later…” |
| ux · Part 0 | “Commands always name a release, never a branch…” | “Commands name releases, never branches…” |
| ux · Part 1 | “Every file is listed before it is written, and recorded so `tenet remove` can undo exactly this.” | “Every file is listed and recorded; `tenet remove` can undo it.” |
| ux · Part 1 | “Each statement names its origin: *observed* in code or tests …” | “Each statement names origin: *observed* (code/tests), *documented* (section), *asked* (your answer), or *inferred* (flagged).” |
| ux · Part 1 | “Only a person explicitly blesses…” followed by the alpha.0/alpha.1/alpha.2 explanation | The shortened blessing paragraph in the same section |
| ux · Part 2 | “Editing the description makes the card re-check without rerunning tests.” | “Editing the description re-checks the card without rerunning tests.” |
| ux · Part 2 | “In the first release `tenet board` shows your specifications …” | “In 0.1.0, `tenet board` shows waiting blessings, edits, changed sources and spec debt.” |
| ux · Part 3 | “After repeated failures (by default, a card failing three times in a row)…” | “After repeated failures (three in a row by default)…” |
| ux · Part 3 | “A way for CI to sign its proof (automatic on public repositories; one CI secret otherwise)… and an account for your agents.” | The shortened verified-work sentence |
| ux · Part 4 | “To go back, install the previous version and run `upgrade` again.” | “To go back, install the previous version and run `upgrade`.” |
| ux · Part 5 | “Context always starts with your global rules…” | “Context starts with global rules…” |
| ux · Part 6 | “Every view states what it was computed from.” | “Every view states its source.” |

## Kept on purpose
- Code blocks are unchanged.
- Markdown headings, front matter, field tables and requirement IDs are unchanged.
- Numbers, thresholds, durations, defaults and versions are unchanged.
- Command names, flags, file paths, error codes and IDs are unchanged.
- The principles table, wording table and rules marked `<!-- invariant -->` or `<!-- provisional -->` remain meaningful and unchanged in substance.
