# Answers — CP-0007 round 10

Answers to `tenet/packets/CP-0007-tenet-new-move-state-only-status/escalations/proposals-r9.md`:

1. **`reduce(events, pack, asOf)` exact return fields (`plan/alpha.1.md` CP-0007; `contracts.md §13`; `messages.md §2`)**
   `reduce` returns `{ state, justified_station, tentative_moves, conflicts, findings, applied, held }`:
   - `justified_station`: last legally reached non-tentative station (or `null` when creation is absent or conflicted).
   - `tentative_moves`: `[{ event_id, station, time, deadline, status: "tentative" | "unjustified" }]`, flipping to `"unjustified"` once `as_of >= deadline` (`time + replay.pending_hours`).
   - Structural reduction `findings` use `finding.json` shape (`severity: "error", rule: null, file: null, line: null`) with registered codes: `TN-EV-DUP`, `TN-EV-ORPHAN`, `TN-EV-CYCLE` (cycle/self-link), `TN-EV-CROSS-WORK` (cross-work predecessor), `TN-EV-NO-CREATE` (missing or competing `work.created`), and `TN-EV-RESOLVE` (incomplete `resolve`).

   *Coordinator note for CP-0054-locked `kernel.md §1` (line 7):* align field names `justified_station`, `tentative_moves`, `conflicts` (`conflict_heads`), `findings` (`TN-EV-*`), `applied`, `held`.

2. **`readProofRecord(path, bytes)` return type and unsupported version error (`plan/alpha.1.md` CP-0007)**
   Returns `{ kind: "proof" | "latest" | "rule-log", schema_version: number | null, data, unknown_fields: string[] }` read-only without inferring v1 claims (`schema_version` defaults to `null` on `latest` pointers and `rules/*.jsonl`; only `schema_version === 1` is supported on `proof/*.json`). Unsupported versions fail with `TN-SCHEMA` (`file: path, line: null`).

3. **`recordForgeEvent(input)` event mapping and stale delivery (`plan/alpha.1.md` CP-0007; `ci.md §4`)**
   Maps `ready_for_review`, `converted_to_draft`, `closed` (`merged: true`), and `closed` (`merged: false`) to immutable observation events preserving `data.forge: { repository, pr, action, delivery, head_sha, resource_url?, recorded_at, signed: false }` (`work.closed` with `endpoint: "integrated"` if merged, `null` otherwise). Stale observations (older timestamp than current state/observation or `head_sha !== current_head_sha`) return `{ recorded: false, reason: "stale-forge-event", observation }` and leave station/closure state untouched.

4. **Aliases and advisory leases (`contracts.md §1`; `plan/alpha.1.md` CP-0007)**
   `deriveAlias(ulid, existingAliases)` returns uppercase `CP-<6+ Crockford Base32 chars>` from `sha256(ulid)`, lengthening by one character on collision against `existingAliases`. `leases.ts` exports `activeLeases(events, asOf)` (unreleased events with `expires_at > asOf`) and advisory `overlaps(leases, paths)` warnings (never blocking gates or reduction).

5. **Partial `resolve` missing conflicting heads (`contracts.md §13`; `algorithms.md` `ALG-05`)**
   A `decision.made` (`resolve`) whose `prev` omits any active conflicting head emits `TN-EV-RESOLVE`, stays in `held[]`, and leaves the active `conflicts[]` open.
