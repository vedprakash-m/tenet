# Draft for the project's instruction file

Offer this once, on a new project, after purpose, scope and constraints are settled and only when the loaded instruction file has no content of its own. Fill every section from what the user said or the repository shows; delete a section you cannot fill rather than inventing it. Preview it as one file; write it only on a yes. Never offer it again after a no.

```markdown
# Instructions for this project

## How to work
- State assumptions; if a request has several readings, list them before choosing.
- Prefer the simplest change that solves the problem. No speculative features or abstractions.
- Change only what the task needs, in the surrounding style. Mention unrelated problems; do not fix them in passing.
- Turn each task into checks that can pass or fail, and loop until they pass.
- For a change that touches shared behavior, say what else it affects before making it.

## What this is
<one sentence of purpose and who uses it> — <the main folders and what lives in each>

## Rules that are easy to break
- <tooling the project requires, for example one data client for all queries>
- <secrets live in .env, never committed; what the app must never write or mutate>
- <architecture boundaries a lint or test already checks>

## Checks
- Run: <test command>. Required: <coverage or lint thresholds, if any>.
- A feature goes spec, then failing tests, then code, then the full checks, then the docs.

## References
- <the spec or requirements file that is authoritative, and where decisions are recorded>

## Writing
Say what you mean in literal words; no metaphor or flourish where a plain phrase exists.
```
