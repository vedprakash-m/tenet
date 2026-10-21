// The reason-code registry (TS Appendix C). Codes are part of the public compatibility contract (TS §6.7):
// additions are minor, semantic changes major. Exit is the code produced when the reason decides the response;
// 0 means it appears inside an otherwise successful response, as a verdict reason or a note.
import type { Reason } from "./schemas.ts";

type Exit = 0 | 1 | 2 | 3 | 4 | 5;

export const REASONS = {
  // verdict and evidence
  "declined-step": [0, "The user declined a mandatory step"],
  "evidence-missing": [0, "No receipt for a required obligation"],
  "stale": [0, "Receipt not valid for the current check-input identity"],
  "evidence-failed": [0, "Introduced failure"],
  "evidence-flaky": [0, "Required check classified flaky"],
  "evidence-inconclusive": [0, "Receipt failed validation"],
  "baseline-failure-excluded": [0, "Pre-existing failure outside agreed scope"],
  "baseline-failure-not-excluded": [0, "Pre-existing failure not excluded"],
  "classification-unknown": [0, "A sealed baseline passed but the start tree was dirty"],
  "basis-element-unverified": [0, "A basis element has no fresh verification and no reason it does not apply"],
  "no-distinguishing-red": [0, "No behavioral red on baseline"],
  "alternative-check-missing": [0, "Declared alternative check lacks its receipt"],
  "red-invalidated": [0, "The acceptance test changed between its red and the candidate run"],
  "test-alongside": [0, "A test-alongside approach with a negative control was used"],
  "accessibility-claim-narrowed": [0, "A changed critical journey lacks a screen-reader check"],
  "audit-unavailable": [0, "Advisory data was unavailable"],
  "fitness-trend-degraded": [0, "A fitness function crossed its declared degradation threshold"],
  "integration-unvalidated": [0, "Integrated tree not rechecked"],
  "dependency-unverified": [0, "A dependency change no verification explains"],
  "locked-test-changed": [0, "Locked file changed without disposition"],
  "marker-unaccepted": [0, "An added skip, focus or suppression marker lacks acceptance by a fresh-context review or the user"],
  // review
  "review-missing": [0, "Required review not recorded"],
  "reduced-independence": [0, "Review was not fresh-context where independence is required"],
  "review-partial-coverage": [0, "The Reviewer reported uncovered parts"],
  "review-stale": [0, "Review predates the current candidate or basis, or its attempt is superseded"],
  "major-undisposed": [0, "A major finding has no disposition"],
  "basis-gap-open": [0, "Review reported an unresolved basis gap"],
  "blocker-open": [0, "Open blocker finding"],
  "assumption-unresolved": [0, "Assumption affecting the claim"],
  "recheck-exhausted": [2, "The contract already used its one focused recheck"],
  "review-result-invalid": [2, "Malformed review result"],
  "narrow-increment": [2, "The basis alone exceeds the manifest budget"],
  // check runs and receipts
  "run-dir-unavailable": [0, "No writable run directory; checks cannot run"],
  "port-in-use": [0, "A brownfield fixed port is already in use"],
  "server-identity-weak": [0, "Server identified by port and ancestry only"],
  "build-not-fresh": [0, "A served check ran on artifacts not built in the same run"],
  "sealed-deps-unavailable": [0, "Sealed baseline lacks matching dependencies"],
  "concurrent-edit": [0, "Inputs changed during a run"],
  "timeout": [0, "Obligation timeout"],
  "not-executed": [0, "Process did not run"],
  "report-missing": [0, "Report missing"],
  "report-invalid": [0, "Report failed limits or parsing"],
  "report-contradiction": [0, "Exit status and report disagree"],
  "population-mismatch": [0, "Executed population differs from the obligation"],
  "zero-tests": [0, "No tests executed"],
  "focused-tests": [0, "Focus markers present"],
  "adapter-unsupported-config": [0, "Project configuration conflicts with the reporter"],
  "adapter-unsupported-version": [0, "Tool version outside the supported range"],
  "run-superseded": [0, "A run finished after cancellation or replacement; its result was discarded"],
  "envelope-unknown": [3, "Unknown network, data or credential exposure"],
  // concurrency, state and recovery
  "kernel-busy": [2, "Another kernel call holds the lock"],
  "work-busy": [2, "A check is running for this work"],
  "owned-by-other-work": [2, "Another contract owns the workspace"],
  "stale-session": [4, "Older generation of this contract"],
  "handle-required": [1, "This call needs a contract handle"],
  "handle-unknown": [1, "That handle does not name a contract here"],
  "not-a-repository": [3, "This folder is not a Git repository"],
  "takeover-check": [3, "The previous generation may still be working"],
  "revision-conflict": [2, "Expected revision differs"],
  "marker-mismatch": [3, "Copied, imported or marker-less state; quarantine decision"],
  "state-recovered-from-backup": [3, "Fallback to state.prev; grants suspended until reconfirmed"],
  "effect-uncertain": [3, "Intent without result that reconciliation could not resolve"],
  "lock-recovery-needed": [2, "A lock breaker died mid-break; a confirmed repair is needed"],
  "migration-needs-approval": [3, "A newer state schema needs a previewed migration"],
  "version-changed": [3, "Tenet version changed mid-contract"],
  "unsupported-record": [4, "Unknown field in a grant, restriction or consent"],
  "preload-present": [4, "A preload flag reached the kernel by another launch path"],
  "storage-protected-full": [2, "Protected data exceeds the ceiling"],
  "disk-full": [2, "No space left"],
  "snapshot-too-large": [2, "A prototype snapshot exceeds 20 MB"],
  "inventory-too-large": [2, "Untracked files exceed limits"],
  "project-file-too-large": [2, "A project file exceeds the bounded read limit"],
  "observation-incomplete": [0, "The hook spool overflowed or a hook failed; cooperative labels apply"],
  "ended-without-finish": [0, "A turn ended while work was active without finish"],
  // git
  "git-locked": [2, "Git index lock held"],
  "git-identity-missing": [2, "No commit identity"],
  "signing-unavailable": [2, "Required signing failed"],
  "hook-failed": [2, "A commit hook failed"],
  "hook-staged-foreign-path": [3, "A hook committed or changed non-Tenet paths; commit kept, recovery offered"],
  "attribution-unexplained-change": [3, "A change no declaration or observation explains"],
  "attribution-mixed-file": [3, "Tenet must edit a file with human changes"],
  "index-sync-needed": [0, "The index was left untouched after a commit; paths listed with a one-step sync"],
  "undo-conflict": [3, "An inverse patch overlaps a later change"],
  "integration-conflict": [3, "Integration is predicted to conflict; paths listed before any switch"],
  "branch-switch-needed": [3, "Integration will switch the editor branch"],
  "repo-state-readonly": [2, "Rebase, merge, conflicts or detached HEAD"],
  "filter-consent-needed": [3, "Executable Git filters configured"],
  "boundary-example-missing": [0, "A requirement has no boundary or negative example; propose one"],
  "filters-not-run": [0, "Git filters apply here; reading never runs them, so a file a filter rewrites can look modified"],
  "hook-consent-needed": [3, "Commit hooks need consent"],
  // authority, configuration and budget
  "capability-missing": [2, "A required host capability is absent"],
  "continue-required": [2, "Policy requires more work before finishing"],
  "approval-gate": [3, "Question required under auto-approve or unknown mode"],
  "basis-confirm": [3, "The proposed basis contains Tenet's additions or a sketch commitment; one confirmation"],
  "support-overlaps-scope": [1, "A support input also names a path the basis expects to change"],
  "intent-markers-invalid": [2, "Malformed managed blocks"],
  "restriction-key-unknown": [2, "Unknown or malformed restriction key"],
  "intent-edited-outside": [0, "INTENT.md changed outside Tenet; the edited blocks stay as written until a diff is accepted"],
  "authority-needed": [3, "A change needs authority the contract does not have; ask the user"],
  "plan-invalid": [2, "The proposed plan or plan item cannot be used"],
  "plan-item-blocked": [2, "The plan item is not ready: it is not accepted, or a dependency is not done"],
  "policy-applied": [0, "Shared policy restrictions applied without a decision"],
  "policy-change-needs-acceptance": [3, "Shared change needs local acceptance"],
  "dependency-rejected": [2, "A dependency change was rejected; manifests restored"],
  "repeated-failure": [2, "Same failure signature twice or oscillation; sets a stop reason"],
  "budget-exhausted": [2, "A limit reached; sets a stop reason"],
  "budget-warning": [0, "80% of a limit used"],
  "host-limit": [2, "The host stopped responding or reported a usage limit; work paused"],
  // starter scaffold (additive to Appendix C: TS §12.2)
  "scaffold-target-not-empty": [2, "A file the starter would write already exists; nothing is overwritten"],
  "recipe-integrity-failed": [4, "The recipe's files do not match its recorded hashes"],
  "install-failed": [2, "The dependency install failed; the scaffolded files are in place"],
  "model-unqualified-for-deep": [3, "Deep work on an unqualified or unknown model or configuration; continue or stop"],
} as const satisfies Record<string, readonly [Exit, string]>;

export type ReasonCode = keyof typeof REASONS;

export const isReasonCode = (c: string): c is ReasonCode => c in REASONS;

/** Build a reason; `detail` extends the registry meaning with the specific fact, `note` marks non-blocking ones. */
export function reason(code: ReasonCode, detail?: string, opts: { note?: boolean; refs?: string[] } = {}): Reason {
  const [, meaning] = REASONS[code];
  const out: Reason = { code, message: detail ? `${meaning}: ${detail}` : meaning };
  if (opts.note) out.note = true;
  if (opts.refs?.length) out.refs = opts.refs;
  return out;
}

export const exitFor = (code: ReasonCode): Exit => REASONS[code][0];
