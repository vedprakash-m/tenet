# Answers — CP-0046 round 12

Answers to `tenet/packets/CP-0046-signed-evidence-and-the-two-job-verifier/escalations/proposals-r11.md`:

1. **`signReceipt` / `verifyReceipt` envelope & store path (`ci.md §5`; `plan/alpha.2.md` CP-0046)**
   `signReceipt` attaches `{ algorithm: "ed25519" | "sigstore" | "oidc", key_id, signature, store_path }` where `store_path` is `"refs/tenet/evidence/<subject-digest>/<id>.json"`. `verifyReceipt` returns `{ valid: boolean, evidence_state: "signed" | "unsigned", backend, store_path }`.

2. **Changed tracked files in sealed test job (`ci.md §5`; `contracts.md §13`; `messages.md §3`)**
   When `after_subject.digest !== before_subject.digest`, the sealed test job marks the check `inconclusive: true`, `result: "inconclusive"`, and emits `TN-SEALED-DIRTY` (added to `contracts.md §13` structural error row and `messages.md §3`). Mismatched `workflow_run` run IDs emit `TN-RECORD-BUNDLE` (`failure` at `verify`).

3. **`recordCandidate` schema and ref storage (`plan/alpha.2.md` CP-0046; `ci.md §§3–5`)**
   `recordCandidate` writes `{ schema_version: 1, repository, candidate_id, candidate_revision, target_revision, member_work, status: "verified" | "failed" | "stale" }` at `candidates/<candidate_id>/<candidate_revision>.json` on `refs/tenet/records` alongside the signed evidence receipt on `refs/tenet/evidence`.

4. **`verifyPersonPresent` output (`plan/alpha.2.md` CP-0046)**
   Returns `{ valid: boolean, accepted: boolean, user_presence: "observed" | "unavailable" | "none", challenge_consumed: boolean, error_kind?: "challenge-reused" | "missing-user-presence" }`. Software Ed25519 keys without hardware `sk-` presence yield `user_presence: "unavailable"`, `accepted: false`, `error_kind: "missing-user-presence"`.
