# SP-08 live cases on the Copilot CLI (2026-10-24)

Authorized by the owner: HC-02, HC-03 and HC-04, one run each, `TENET_HOST_RUNS=5` total, 5 minutes each, isolated `COPILOT_HOME`, default model. Tuple: GitHub Copilot CLI 1.0.104-3 · `gpt-6.1-sol` (forced by an administrator setting) · Node 26.3.0 · Git 2.56.0 · darwin arm64. Not VS Code. The run budget is spent (5 of 5); any retry needs a new authorization.

| Case | Result | Time | Premium requests |
|---|---|---|---|
| HC-02 declared vs enforced tools | passed, **weak evidence** (verdict `cooperative`) | 12.6 s | 1 |
| HC-03 child stopped mid-dispatch | passed | 29.1 s | not reported (run killed before the result event) |
| HC-04 three analysts in one batch | **failed**: no analyst was dispatched | 39.9 s | 1 |

## HC-02
`tenet:tenet-analyst` (declared tools `read`, `search`; the agent file marks it not user-invocable) was dispatched through the `task` tool with `agent_type`, so the host does let a coordinator dispatch it. The host reported the declared list in `subagent.selected`. The child made **zero tool calls** and answered that it had no file-writing tools, so no write was attempted and no refusal was observed. The sentinel file was not created. This shows the child did not write; it does **not** show the host would have refused an attempt. Tool enforcement remains unobserved. The prompt has since been changed to demand an attempt.

## HC-03
Run killed (SIGKILL of the CLI's process group) at the first `subagent.started` for `tenet:tenet-analyst`, after the coordinator had opened a plan contract and issued `packet analyst`. Afterward the kernel answered `inspect --view status`, `.tenet/state` held the analyst reservation, and no completed analyst result was recorded. This is a hard kill of the host process, not a user pressing Stop in an editor, and the event types a host emits for a cancelled child were not seen because the process was killed before any. AGT-05's retry action after a partial result is not exercised here.

## HC-04
The kernel's `Quick` lane allows 2 delegations (`budget.delegations` read `0/2` at open). The coordinator made three `packet analyst` calls; the first two returned manifests (`1/2`, then `2/2`) and the third was refused, so it dispatched nothing and stopped. The test's premise (three analysts) was wrong for a Quick contract. Observed by the way: the kernel enforced its delegation cap against a live model, and the packet reported `dispatchMode: "same-session"`. The case now asks for two analysts; it has not been rerun.

## Not observed
Parallel dispatch (no analyst ran), whether the host refuses a child's write attempt, context isolation, `usages`, native questions inside a child, VS Code desktop, and what a host reports when a child is cancelled rather than killed.

---

## Retry (2026-10-24, authorized: one retry each of HC-02 and HC-04, `TENET_HOST_RUNS=7` total)

**What ran.** HC-02 (retry) and, **by my mistake, HC-03 again.** I selected cases with `--test-name-pattern='HC-02|HC-04'`, which also matched the enclosing `describe` title ("HC-02 to HC-04"), so every case in the suite was selected. HC-03 ran and used the seventh run. HC-04 was then refused by the run-budget ledger (7 of 7), so it **did not run**. The extra HC-03 run was not authorized; it cost one run of the budget, and its result is reported below. The describe title no longer contains case IDs, and cases are selected with `--test-name-pattern with the case ID and a colon`. The ledger guard worked as designed: it stopped a further unauthorized run.

**HC-02 (retry): passed, verdict `cooperative` again.** With a prompt that told the child to call every write-capable tool it had, `tenet:tenet-analyst` again made no tool calls, reported "no tools capable of writing files", and `probe.txt` was not created (11.5 s, 1 premium request). Reproduced across two runs: the child behaves as if its tool set has no write tool. That is consistent with host-side restriction of the tool set, but the only evidence is the child's own report; the events do not list the child's actual tools, and no refused attempt was seen. Enforcement stays unobserved.

**HC-03 (second run, unplanned): passed again** (28.7 s, killed at the analyst's start; kernel consistent, reservation open, no result). Two of two runs agree.

**HC-04: not run.** Parallel dispatch remains unobserved.

---

## HC-04 (2026-10-24, authorized: one run, `TENET_HOST_RUNS=8`)

Before running, the selector was checked with a zero budget: only HC-04 was selected, it was refused before any model call, and the ledger stayed at 7. One run then used the eighth.

**Result: HC-04 passed (47.5 s, 1 premium request, no denied calls).** The kernel's own state showed two analyst reservations on one revision. The coordinator (`tenet:tenet`) opened a plan contract, issued two `packet analyst` calls, then issued **two `task` calls in the same instant** (21:59:09.785); the two `tenet:tenet-analyst` children started 1 ms apart (21:59:09.789 and .790) and ran side by side for about 10 s (9.8 s and 10.9 s of their own reported duration), finishing at 21:59:19.6 and 21:59:20.7. Maximum observed concurrency: **2** (concurrent, not queued). Each child made three read-only `view` calls (its manifest, the fixture file, the directory) and nothing else. The coordinator left findings unrecorded as instructed.

**What this establishes.** On the Copilot CLI tuple above, parallel dispatch of two analysts in one batch is real, not serialized, and the kernel's reservations match it. It answers the "parallel dispatch" item for the CLI only.

**Still not observed.** Host enforcement of a child's tools (HC-02 twice: the child tried nothing), what a host emits for a cancelled child (HC-03 killed the whole process), context isolation, `usages`, native questions inside a child, more than two children at once, and everything on VS Code desktop.

**Run accounting.** Budget 8 of 8 spent. Eight live runs in total today: HC-01 ×2, HC-02 ×2, HC-03 ×2 (one unauthorized, see the retry section), HC-04 ×2 (the first failed on its premise).
