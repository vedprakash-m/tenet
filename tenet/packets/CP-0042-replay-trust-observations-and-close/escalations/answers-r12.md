# Answers — CP-0042 round 12

Answers to `tenet/packets/CP-0042-replay-trust-observations-and-close/escalations/proposals-r11.md`:

1. **`replay(history, snapshot, asOf)` return shape (`plan/alpha.2.md` CP-0042)**
   `replay` returns `{ transitions, state, findings }` where each `transitions[]` item is `{ event_id, type, status: "justified" | "pending-evidence" | "unjustified", reason?: string }`, and `state.endpoint` records the computed close endpoint (`checked | integrated | implemented-unverified | cancelled | superseded | null`).

   *Coordinator note for CP-0054-locked `kernel.md §1` (line 34):* record transition shape `{ event_id, type, status, reason? }` and `state.endpoint`.

2. **`observeTrust(input, asOf)` return shape & `doctor` trust (`plan/alpha.2.md` CP-0042; `evidence.md §4`)**
   Returns `{ t1, t2, t3, t4, merge_requires_status, observed_at, stale, guarantee }`, where `t1`–`t3` record verified/declared status, `t4` is `"enforced" | "declared" | "unknown"`, `merge_requires_status` is `true | false | "unavailable"`, `stale` is `asOf - observed_at > 7d`, and `guarantee` is `"enforced*"` only when `t1 && t2 && t3 && t4 === "enforced" && merge_requires_status === true && !stale` (otherwise `"detected"`, or `"unavailable"` if controls are absent). `tenet doctor` reads these fields offline.

3. **`requiredOutcome` signature & `degraded`/`reasons` (`plan/alpha.2.md` CP-0042; `ci.md §10`)**
   Accepts evaluation state, policy `level`, trust observation, and any override waiver, returning `{ conclusion: "success" | "neutral" | "failure", guarantee: "enforced*" | "detected" | "advisory" | "unavailable", reasons: string[], degraded: string[] }`.
   - `store-loss` appends `"results not kept"` to `degraded` (`neutral` below `verify`, `failure` at `verify`/`assure`).
   - Explicit override sets `accepted_without_verification: true`, `label: "accepted-without-verification"`, and includes `"accepted-without-verification"` in `reasons`.
   - Shared decision account (`pr_opened_by_agent_session_for === decision_actor_account` without `host_t4_attested`) sets `t4_attested: false`, degrades `guarantee: "detected"`, and includes `"shared-decision-account"` in `reasons`.

4. **Alpha.2 close endpoints vs GA `close` (`plan/alpha.2.md` CP-0042)**
   In `alpha.2`, `replay` computes `state.endpoint` deterministically from `work.closed` and claim verification (`checked` / `integrated` when verified and un-overridden; `implemented-unverified` when closed/merged externally without verified claims or with an override; `cancelled` / `superseded` from closure kind). Interactive GA `tenet close` command execution stays deferred to `0.1.0`/`0.1.x`.
