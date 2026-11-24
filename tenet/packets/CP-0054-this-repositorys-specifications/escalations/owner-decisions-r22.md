# CP-0054 Second Pass — Owner Decisions (Round 22)

Recorded verbatim on 2026-11-24 from the Owner's adjudication accepting all five decisions in [second-pass-r21.md](second-pass-r21.md).

1. Apply `escalations/vision.patch` to `tenet/vision.md` exactly as written, with `git apply`. The Owner authorized this one edit to `vision.md`. Change nothing else in that file.
2. `catalog.md`: keep PR #5's 8-column tables (`Origin: asked`) and re-apply CP-0039's `R-175` and `R-177` wording with `| asked | |`.
3. The `{...}` bullets: write the PARSER CLARIFICATION into `contracts §3`, and do NOT rewrite those bullets. A requirement's metadata block is a trailing `{...}` outside inline code at the end of a requirement line; braces inside backticks, or anywhere else in a bullet, are prose. Commit this early: MAI implements it.
4. Budgets: trim wording, or move whole sections to sibling parts with pointers, to keep every file under 90% even after adding front matter. Never raise a budget.
5. `tenet.yaml`: add `specs.documents` listing all 24 active specification files with their levels (the Owner authorized this edit), and prepare the 14 remaining split files: front matter, section entries, all sections `draft`.

Also apply `deferred-edits.md` (8 edits), keeping budgets.
