# Answers — CP-0019 round 11

Answers to `tenet/packets/CP-0019-decisions/escalations/proposals-r10.md`:

1. **`makeRequest(input)` exact `request_id` tuple & `renderRequest(request)` layout (`ci.md §6`; `plan/alpha.1.md` CP-0019)**
   - `request_id` is `"sha256:"` plus lowercase hex SHA-256 of UTF-8 RFC 8785 serialization of:
     `{ domain: "tenet.decision.request.v1", repository, work, target, subject, decision_kind, question, choices, evaluation_id, policy_revision, allowed_actors, expires_at }`, where `choices` keeps its ordered `[{ id, label }]` items and `allowed_actors` is sorted ascending ASCII.
   - `renderRequest(request)` renders LF-terminated Markdown:
     `### Tenet decision · <work> · <decision_kind>`, blank line, `<question>`, numbered choice lines `- <id>. <label>`, blank line, and footer `Reply \`/tenet approve @<evaluation_id>\` or \`/tenet pick <n> @<evaluation_id>\` (expires <expires_at>).`.
   - *Coordinator note for CP-0054-locked `kernel.md §3` (line 48):* add the literal domain `"tenet.decision.request.v1"` and `choices: [{ id, label }]`.

2. **Exact finding codes in `recordAnswer(request, event, snapshot).findings` (`contracts.md §13`; `messages.md §3`)**
   - Unlisted actor (`event` author/reviewer absent from `allowed_actors` / `owners[].forge_accounts`): `TN-DEC-ACTOR` (`error`).
   - Stale `@evaluation` or changed `evaluation_id`: `TN-DEC-STALE` (`warning`, triggers fresh request prompt).
   - Late reply (`created_at >= request.expires_at`): `TN-DEC-EXPIRED` (`warning`, triggers fresh request prompt).
   - Unqualified reply across `>= 2` open requests: `TN-DEC-AMBIGUOUS` (`warning`, triggers fresh request prompt).
   - Concurrent competing `/tenet pick` answers: `TN-DEC-CONFLICT` (`error`, unresolved until resolution).
   - Key revoked before signing (`signed_at >= key.revoked`) or self-approval at `verify`/`assure`: `TN-DEC-KEY-REVOKED` (`error`) and `TN-DEC-SELF-VERIFY` (`error`).
   - All seven templates live in `messages.md §3` until `CP-0019` wires them into `src/core/messages.ts` and promotes them to `messages.md §2`.

3. **Self-acceptance attribution representation (`ci.md §6`)**
   Below `verify` (`observe`, `protect`), owner self-acceptance sets `decision.proof.self_accepted: true` alongside the true `strength` (`"forge-verified"`). At `verify` and `assure`, self-approval is refused (`decision: null`, finding `TN-DEC-SELF-VERIFY`).

4. **Storage of `/tenet bless <doc>#<slug>` and `/tenet not-useful <finding>` (`ci.md §§4, 6`)**
   - `/tenet bless <doc>#<slug>` records an attributed `decision` (`kind: "approve"`, `name: "bless-section"`, `target: "<doc>#<slug>"`, `recorded: "forge"`, `data: { doc, section, blessed_digest, signer, commit_author }`).
   - `/tenet not-useful <finding>` records an immutable `observation` (`{ kind: "not-useful", finding_id, reason, actor, evaluation_id, recorded_at }`) without emitting a `decision` (`decision: null`).
