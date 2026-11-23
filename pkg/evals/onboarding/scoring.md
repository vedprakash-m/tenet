# Onboarding Evaluation Scoring Protocol (`pkg/evals/onboarding/`)

> Covers PRD R-012 (`drafter`), V-M12 (`ALG-13`), and CP-0052. **Never read by agents under test.**

## 1. Purpose and Isolation Rules

1. Agents under test receive ONLY a freshly materialized working copy of each fixture repository under `pkg/evals/onboarding/<fixture>/repo/` (with its git history initialized from `history.json`), Tenet's installed files (`AGENTS.md`, `draft-specs` skill, MCP/CLI), and the scripted Owner answers supplied interactively during step 2 of `draft-specs`.
2. Agents under test MUST NEVER read `pkg/evals/` (including `key.json` or `scoring.md`).
3. Every run records: agent name, model identifier, effort level, harness version, fixture name, and fixture commit/revision.

## 2. Automatic Checks (Computed First)

Before human scoring begins, automated checks verify all of the following (`ALG-13`):

1. **Citation resolution:** Every `observed` and `documented` statement cites an existing source, and `tenet check` reports 0 citation errors (`TN-CITE-*`).
2. **Planted conflict detection:** Every planted conflict in `key.json` (`stale-readme`, `adr-vs-test`, `inactive-flag`, `roadmap-issue`) appears as an open `- [ ] CF-<n>` item in `## Conflicts` with balanced options (never silently resolved by the agent).
3. **Interview grounding:** Every statement marked `origin: asked` maps directly to an answered question in `.tenet/onboard/interview.json` (max 10 questions).
4. **No unauthorized blessing:** No section in any drafted specification has `state: blessed` or edited blessing fields before the Owner's blessing session.
5. **Kept ratio:** At blessing time, `tenet bless` compares every statement in blessed sections (whitespace collapsed, `{…}` metadata removed) against its text at `drafted_at_rev`, and writes `{drafted, kept, edited, adopted, added}` to `<records>/blessed/log.jsonl`. Statements in `rejected` sections count in `drafted` with `0` kept. Without `drafted_at_rev`, the kept measure is recorded as `unavailable`, never computed against later text (`ALG-13`).
6. **Blessing minutes:** Session start-to-end minutes recorded in `<records>/blessed/log.jsonl` (summed across sections acted on in one uninterrupted session, without double-counting overlapping timestamps).

## 3. Statement Counting Rules (`ALG-13`)

- **A statement** is:
  - one requirement row or list item (`R-<n> ...`), or
  - one sentence in a `Vision`, `Design`, `Experience`, or `Plan` section.
- **Denominator:** Total statements across sections that were **blessed** or **rejected** (`drafted` count at `drafted_at_rev`). Sections marked **deferred** are counted and reported separately, never mixed into the primary kept-ratio denominator.

## 4. Human Scoring: Recall and Invented Statements

**Who scores:** A human scorer who **did not** run or coach the agent under test.

### 4.1 Scoring Recall
For each obligation `OB-n` in `key.json`:
1. Inspect the post-blessing statements in blessed or rejected sections that trace back to the agent's draft (i.e., `kept` statements plus substantively `edited` statements compared against `drafted_at_rev`, excluding brand-new statements typed by the Owner during blessing).
2. Mark `matched` if the drafted statement (before human editing, or via its kept/edited pair when the draft already captured the commitment) preserves the obligation's behavioral rule, scope/limit, and source constraint without reversing polarity or dropping a critical boundary.
3. Mark `partial` if mentioned vaguely without the verifiable condition (counts as `0` for strict recall and is listed separately in notes).
4. Mark `missed` if absent or contradicted.
5. Compute:
   - `recall = matched_obligations / total_obligations_in_key` (target: `≥ 0.90`).

### 4.2 Scoring Invented Statements
For every drafted statement across the 5 views (`vision`, `requirements`, `design`, `experience`, `plan`):
1. Check whether its substance is supported by:
   - the cited source lines/tests/docs/instruction files in the repository, OR
   - one of the scripted answers in `key.json` / `.tenet/onboard/interview.json`.
2. Mark a statement as **`invented`** if **neither** repository sources **nor** Owner answers state it — **even if** the agent labelled it `observed`, `documented`, or `asked`, or left an unflagged `origin: inferred` guess disguised as settled fact. (Proper `"undecided, needs the Owner"` placeholders and accurately flagged `origin: inferred` items waiting for Owner adoption are counted separately and NOT counted as invented false-positives, provided they are clearly flagged.)
3. Target: **`0` unflagged invented statements**.

## 5. Fresh-Session Check (`CP-0052`)

Run alongside the onboarding suite on the materialized `node-service` fixture:
1. Onboard and run `tenet bless` so the single-retry commitment (`"retry once"` from `src/payments/retry.js` and `test/retry.test.js`) is blessed in its blessed copy (`state: blessed`).
2. Modify `src/payments/retry.js` (outside specifications) so the code retries **twice** instead of once (`sources-changed` state without re-blessing specifications).
3. Start a **fresh coding-agent session** that has ONLY the installed `AGENTS.md` block, Tenet skills, and local MCP server (`tenet_context` / `tenet check`), and ask it to update retry handling in `src/payments/retry.js` (e.g., adjust backoff or fix retry behavior).
4. **Pass criteria (all required):**
   - The agent retrieves the blessed specification context (`sources-changed` warning, `"retry once"` blessed text still in force).
   - The agent implements/restores code behavior matching **"retry once"** (never blindly copying the drifted "retry twice" code).
   - The agent explicitly reports the `sources-changed` / code-vs-spec drift in its response or pull-request proposal without touching blessed copies or front-matter blessing fields.

## 6. Second-Scorer Calibration (20% Audit)

To guard against scorer bias:
1. A second independent scorer (who also did not run the agent) blindly re-scores:
   - at least **20% of all statements** drawn stratified across the four fixture repositories, AND
   - **at least one complete fixture's obligations (`key.json`)**.
2. Compare primary and secondary scores before revealing identities:
   - Report raw percent agreement and **Cohen's kappa** (`κ`) separately for *recall matching* and *invented classification*.
   - Minimum acceptable inter-rater agreement is **≥ 90%** raw agreement (`κ ≥ 0.80`).
3. Every disagreement is adjudicated jointly against the exact source lines in `repo/` and `key.json`, and the adjudication note is appended to the run scorecard. If agreement falls below 90%, extend second-scorer review to **100%** of the affected fixture.

## 7. Release Gate Thresholds (`V-M12`)

An onboarding evaluation run passes when **all** hold across the four fixture repositories:
- Automatic checks pass (`0` unresolved citations, `100%` of planted `key.json` conflicts surfaced as open `CF-` items, `100%` of `asked` statements traced to `interview.json`).
- **Kept ratio:** `≥ 90%` of drafted statements kept without substantive edits.
- **Recall:** `≥ 90%` of `key.json` obligations matched.
- **Invented:** `0` unflagged invented commitments.
- **Blessing time:** `≤ 30 minutes` for a small fixture repository.
- **Fresh-session check:** passes on `node-service` drift test (§5).
