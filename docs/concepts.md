# Tenet concepts

## The document ladder

| Level | What lives there |
|---|---|
| L0 | Vision and intended outcomes |
| L1 | Product requirements and adopted governance |
| L2 | Design, experience and plan |
| L3 | The definition of a change, in a pull request or change packet |
| L4 | Implementation and tests |

A small project can keep several levels in a single `intent.md`. Ownership follows the section's level. Requirements have IDs, origins and links to the vision. Observed and documented statements cite sources. Asked statements record a person's answer or adoption. Inferred statements stay flagged until reviewed.

A citation check confirms that the cited lines exist, not that they support the statement.

## Blessing and authority

A blessing is an authorized person's decision to put a section in force. Whether the text is right remains their judgment. The recorded blessing shows who gave it and is advisory. Drafts and unblessed edits can be reviewed as hints. The last blessed text stays in force until a replacement is blessed. A changed citation asks for review. A person can confirm the existing text against changed sources in the blessing workflow. A section can be left for later while other sections are blessed.

## Reading the proof card

The card names the commit it evaluated, shows the relevant blessed requirements and records what tagged tests reported. Read the acceptance item and test result together before deciding whether the test is adequate.

| Card wording | What it tells you |
|---|---|
| `test passed on this commit` | Every tagged test ran and passed on the named commit. |
| `written in this change` | The tagged test came with the change. |
| `tag added here` | An existing test was newly tagged. |
| `coverage not confirmed` | Tagged results passed, but Tenet could not match every tagged test. |
| `not run` | Some tagged tests did not run. |
| `no test` | No test carries the item tag. |
| `no weakening detected` | Tenet's deletion and skip checks found no weakening. |
| `advisory` or `would have blocked` | The check reports the finding and leaves the decision to you. |

## Adoption levels and rule modes

An adoption level describes the setup. A rule mode describes what happens on a finding. `observe` records findings, `advise` reports what would have blocked, and `enforce` blocks as the rule specifies. Tenet 0.1.0 starts in `observe` and its proof rules are advisory. Rule enforcement, signed verification and person-present controls are planned for later releases.

## What each result can tell you

| Class | Example |
|---|---|
| Checked by Tenet | Which named tests reported results on the commit and whether citations resolve. |
| For you to judge | Whether tests cover the intended behavior and whether to bless a draft. |
| Depends on your agent or host | Whether the host reads context, follows skills or restricts access. |
| Not done by Tenet's core | Running agents, dispatching work and running fleets. |

## Sources

- [PRD](../tenet/specs/prd.md)
- [UX specification](../tenet/specs/ux-spec.md)
- [Technical specification](../tenet/specs/tech-spec.md)
- [Tooling requirements](../tenet/specs/prd/tooling.md)
- [CI specification](../tenet/specs/tech-spec/ci.md)
