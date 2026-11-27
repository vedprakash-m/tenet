# Budget trim · onboarding.md and ux-spec.md
## Summary
| File | Tokens before | Tokens after | % of 6,000 |
|---|---:|---:|---:|
| `tenet/specs/tech-spec/onboarding.md` | 5,517 | 4,798 | 79.97% |
| `tenet/specs/ux-spec.md` | 5,539 | 4,795 | 79.92% |

## `tenet/specs/tech-spec/onboarding.md`
| Section (heading) | Tokens before | Tokens after | What was cut | Where it is still said |
|---|---:|---:|---|---|
| `_preamble` | 112 | 112 | None | same section |
| `1. Onboarding and blessing (R-223)` | 2,303 | 2,070 | Shortened context, inventory, project-kind, draft-format and blessing prose | same section |
| `2. Install and upgrade` | 2,394 | 2,052 | Shortened host, upgrade, path, replay and removal prose | same section |
| `3. Onboarding measures (ALG-13)` | 415 | 340 | Shortened kept, recall and invented definitions | same section |
| `4. Release procedure` | 211 | 164 | Shortened release steps without changing the sequence | same section |

## `tenet/specs/ux-spec.md`
| Section (heading) | Tokens before | Tokens after | What was cut | Where it is still said |
|---|---:|---|---|---|
| Preamble | 170 | 154 | Shortened context and actor prose | same section |
| `Part 0: get Tenet` | 429 | 395 | Shortened requirements and install wording | same section |
| `Part 1: start here` | 1,571 | 1,419 | Shortened onboarding, drafting, blessing and next-step prose | same section |
| `Part 2: the daily loop` | 763 | 695 | Shortened card, review and board prose | same section |
| `Part 3: when you want more` | 456 | 360 | Shortened rules, decisions, lanes and verification prose | same section |
| `Part 4: keeping Tenet current` | 261 | 227 | Shortened upgrade and removal prose | same section |
| `Part 5: the agent's side` | 381 | 309 | Shortened agent-context and host prose | same section |
| `Part 6: reference` | 985 | 786 | Shortened principles, board, output and wording text | same section |

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
