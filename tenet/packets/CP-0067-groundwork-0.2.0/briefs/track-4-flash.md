# Track 4 (MAI Code 2 Flash) · bring two specification files under 80% of budget

**Your files:**
- `tenet/specs/tech-spec/onboarding.md`, now 5,517 of 6,000 tokens (92%);
- `tenet/specs/ux-spec.md`, now 5,539 of 6,000 tokens (92%);
- your report, `tenet/packets/CP-0067-groundwork-0.2.0/budget-trim.md`.

Your pull request changes nothing else.

**Goal:** get each file **under 4,800 tokens** without changing what it means. 0.2.0 will add text to both files, so they need room.

## Measure

Run `node dist/cli.js check`. It prints each file's token count when the file is at 90% or more. To see the count below 90%, run `node dist/cli.js check --json` and look for the budget numbers. If `--json` doesn't show them, say so in your report and use the last count you saw.

## You may

- Delete a sentence that says the same thing as another sentence in the same file, or in a file it already links to. Keep or add the link.
- Shorten a wordy sentence while keeping every fact in it.
- Merge two adjacent sentences that repeat a subject.
- Replace a long list of examples with the two clearest ones, but only where the text marks them as examples ("for example", "such as", "e.g.").

## You must not change

- any requirement, rule or limit; any word such as "must", "never", "only", "at least" or "unless";
- any number, threshold, duration, version or default;
- any command, flag, file path, field name, error code (`TN-…`) or ID (`R-…`, `ALG-…`, `DEC-…`, `L-…`, `CP-…`);
- any heading's text. Headings are section IDs in the front matter;
- the front matter, except what `tenet check` tells you to update;
- code blocks, tables of fields, and anything marked `<!-- invariant -->` or `<!-- provisional -->`.

If you can't reach 4,800 tokens without breaking a rule above, **stop at the lowest count you can reach** and explain why in your report. Don't break the rule.

## After editing

1. Run `node dist/cli.js check`.
   - If it reports a digest or `edited` problem on a section you changed, follow the fix it prints.
   - If it prints no fix, stop and write the full message in your report.
2. Run `npm run lint` and `npm test`.

## Report shape (exactly this)

```
# Budget trim · onboarding.md and ux-spec.md
## Summary
| File | Tokens before | Tokens after | % of 6,000 |
## <file>
| Section (heading) | Tokens before | Tokens after | What was cut | Where it is still said (file#section or "same section") |
## Sentences removed
For each removed sentence: the section, the full original sentence, and the sentence or link that still carries its meaning.
## Kept on purpose
Long passages you left alone, and the rule above that stopped you.
```

The pull request body says: **"Proposal: specification text trimmed without change of meaning; for the Owner's blessing."**
