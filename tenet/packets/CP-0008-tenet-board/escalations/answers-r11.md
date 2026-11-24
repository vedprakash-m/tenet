# Answers — CP-0008 round 11

Answers to `tenet/packets/CP-0008-tenet-board/escalations/proposals-r10.md`:

1. **`board.json` nested field shapes for flow, queues, active runs, and friction (`plan/alpha.1.md` CP-0008; `contracts.md §5`)**
   - `flow`: `{ verified_per_week_by_lane: { quick, careful, deep, express }, lead_time_hours: { median, p85 }, lane_mix_quick_express_pct, decision_wait_hours, cost: { total, unit, status: "known"|"estimated"|"unavailable", source }, escapes, autonomy_share }`.
   - `decision_queue[]`: `{ request_id, work, target, decision_kind, actor_eligible, expires_at }`.
   - `review_queue[]`: `{ work, judge, round, status, requires_human }`.
   - `active_runs[]`: `{ work, station, step, attempt, adapter, started_at }`.
   - `friction[]`: `{ rule, refusals, overrides, waivers, not_useful, total_checks, not_useful_pct, false_blocks_per_100, flagged_for_demotion }` (`flagged_for_demotion: not_useful_pct > 10 || false_blocks_per_100 > 2`).
   - Owner-merged self-acceptance below `verify` sets `self_accepted: true` on `items[]`.

2. **`renderBoard(board) -> { markdown, html }` layout (`plan/alpha.1.md` CP-0008)**
   - `markdown` uses LF line endings opening with `<repo> · <branch> <rev> · level <level>`, then non-empty sections in fixed order: `Waiting for you (<n>)`, `Blocked (<n>)`, `Changed since you looked (<n>)`, `Friction (<n>)`, `Flow`, plus spec sections; empty repositories emit `No active work items.`.
   - `html` emits a single self-contained UTF-8 HTML document (`<!doctype html>`, inline `<style>` only, zero external `<script src>` / `<link href>` URLs, HTML-escaped values matching `board.json` and `markdown`).

3. **`--since <rev>` filtering semantics (`plan/alpha.1.md` CP-0008)**
   Filters `items`, `decision_queue`, `review_queue`, and `specs` to entries changed relative to `<rev>`. Invalid or unreachable `<rev>` fails cleanly with `TN-USAGE-REF` (exit `2`).

4. **Changed records ref, corrupted events, and stale trust (`plan/alpha.1.md` CP-0008; `evidence.md §4`; `messages.md §3`)**
   Unexpected `refs/tenet/records` tip drift emits warning `TN-RECORD-TIP` in `board.json.findings[]`, and tampered events emit `TN-EV-DUP` (never silently dropped). Trust observations older than 7 days (`now - observed_at > 7d`) downgrade `guarantee` from `enforced*` to `detected` (or `unavailable` when never observed).

   *Coordinator note for CP-0054-locked `tech-spec.md §8` (line 223):* note `--since <rev>` invalid ref exits with `TN-USAGE-REF` and tampered records emit `TN-RECORD-TIP`/`TN-EV-DUP` in `board.json.findings[]`.
