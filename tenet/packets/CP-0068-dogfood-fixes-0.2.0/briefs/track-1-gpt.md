# Track 1 · GPT · Group A (front matter), then B2 and B3

Read [common.md](common.md) first. Worktree: `Q:\Ved\Pers\tenet-track1`.

## Part 1 · Group A: specification front matter (branch `cp-0068/a-front-matter`)

These are the two blockers. Do this part first.

### What was observed (synthetic)

An agent followed the `draft-specs` skill in a one-file layout and wrote `tenet/intent.md` **with no front matter**. Then:

1. `tenet fix` returned `{"changes": []}`, and `tenet check` returned `0 errors`. Meanwhile `tenet board` said `No specifications found · run tenet onboard`.
2. `tenet onboard --card` failed with `TN-SPEC-NO-FRONT`, *"Specification file has no valid YAML front matter."*, and its next step was *"…or run `tenet fix`"*. That `fix` had already done nothing.
3. The agent then made up a front matter:
   ```yaml
   ---
   tenet: "~0.1"
   sections:
     - id: vision
       heading: Vision
       level: L0
   ---
   ```
   `onboard --card` still failed with `TN-SPEC-NO-FRONT`, because `card.ts` requires `tenet.spec === 1`.
4. `tenet bless` accepted that file: `matter()` in `src/onboard/bless.ts` checks only `isMap`. It asked about all 6 sections, printed `Blessed 0 of 6 sections`, then for each section: `Internal failure: Expected a valid index, not vision.` (`TN-INTERNAL`). That comes from `front.yaml.setIn(["sections", slug, …])` on a YAML **list**, around line 591.

### Acceptance

AC-A1 to AC-A5 in [definition.md](../definition.md#a--specification-front-matter-is-checked-and-written-in-one-place-r2-13-r2-16).

### Specifications to read

- `tenet/specs/tech-spec/contracts.md` §3: the front matter and draft format.
- `tenet/specs/tech-spec/onboarding.md`: the draft format, the onboarding card, checks and blessing.
- `tenet/specs/tech-spec/algorithms.md`: ALG-02 (sections and digests) and ALG-03 (bless).
- `kit/schemas/`: any `spec-front-matter` schema. `bless.ts` already reports `schema: "spec-front-matter"`.

### Code to start from

- `src/specs/parse.ts` (`TN-SPEC-NO-FRONT` at about line 619), `src/specs/check.ts` and `src/specs/fix.ts` (the `intent.md` handling at about lines 232 and 497–534);
- `src/onboard/card.ts` (about line 168) and `src/onboard/bless.ts` (`matter()`, and the section writes at about lines 520–600);
- the views behind `tenet board`;
- `kit/skills/draft-specs/SKILL.md`.

### Notes

- **One validator** means one exported function, used by all five commands. Don't add a sixth copy.
- What a missing or wrong front matter means:
  - in a file at the **assignment's output path**, it's an error;
  - in other Markdown, it's not a specification, as today.
- After the change, follow the skill's steps in order on a synthetic project, and prove that `check`, `onboard --card` and `bless` all accept the result. That's AC-A3.

## Part 2 · Group B (branch `cp-0068/b-false-positives`, after Part 1's pull request is green)

- **AC-B1 (R2-15).** The Owner decided this one as OD-13, option A, in [L-0043](../../../ledger/L-0043-owner-decisions-0.2.0.md).
  - Observed: `verify --local` on the pull request that adds Tenet printed `Would have blocked: protected files modified: .github/workflows/tenet-tests.yml, .github/workflows/tenet.yml, tenet.lock, tenet.yaml · no acceptance items`.
  - Rule: apply the exemption only when the **base commit has no `tenet.yaml`**, and only to protected paths that `init`'s manifest lists. Those paths become one note: *"First-time setup: protected Tenet files are expected in this pull request."* Every other protected path is still flagged.
  - Spec: the `protect` rules in `ci.md` and contracts, as a **proposal** in the pull request.
- **AC-B2 (R2-18).** Observed: a change to a normal script, not a test, containing `sys.exit(1)` in two error branches, reported `! weakening detected: skip-added in <script> (sys.exit(1))`.
  - Code: `src/reports/weakening.ts` and `src/reports/types.ts`.
  - Spec: the weakening rules in `tenet/specs/tech-spec/ci.md`, and ALG-09 (test files).
- **AC-B3 (R2-09).** Observed: a Markdown file with inline code `@Name.member` and plain words reported `dead-path` (`links missing path @Name.member`). In one repository, 1,225 of 1,226 first findings were `dead-path`.
  - Code: `src/onboard/findings.ts`.
  - Spec: `onboarding.md`, *First findings*.
