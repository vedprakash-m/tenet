import { ownedProofs } from "../core/commit-proof.ts";
import type { CommitProofV1 } from "../core/commit-proof.ts";
import { KernelError } from "../core/errors.ts";
import type { State, WorkContract } from "../core/schemas.ts";
import type { Ports } from "../ports/types.ts";

const refuse = (why: string): never => { throw new KernelError("undo-conflict", why); };
async function selectedRef(ports: Ports): Promise<string> {
  try { return (await ports.git.commitContext()).ref; }
  catch (error) {
    if (!(error instanceof KernelError)) throw error;
    return refuse(`the undo target must be an available symbolic branch: ${error.message}`);
  }
}
function readProofs(ports: Ports): CommitProofV1[] {
  try { return ports.store.commitProofs(); }
  catch (error) {
    return refuse(`durable commit proof cannot be read safely: ${error instanceof Error ? error.message : String(error)}`);
  }
}
/** Called afresh for preview and confirmation; discovery never substitutes for the private witness. */
export async function undoOwnership(
  ports: Ports, state: State, work: WorkContract, pinned?: { head: string; branch: string | null },
): Promise<string[]> {
  const proofs = ownedProofs(readProofs(ports), state, work);
  if (!proofs) return refuse("commit ownership cannot be established: legacy-unproven, missing or conflicting attribution proof");
  for (const proof of proofs) {
    if (!await ports.git.verifyCommit(proof)) return refuse("a physical commit no longer matches its durable attribution proof");
  }
  const integration = work.git.integrated;
  const origins = new Set(proofs.map(p => p.ref));
  if (!integration && origins.size !== 1) return refuse("owned commits do not share an exact origin ref");
  const target = integration ? `refs/heads/${integration.into}` : proofs[0]!.ref;
  if (pinned?.branch !== undefined && pinned.branch !== target) {
    return refuse("the exact undo target ref must be checked out; no branch was switched");
  }
  if (await selectedRef(ports) !== target || !await ports.git.refCommit(target))
    return refuse("the exact undo target ref must be checked out; no branch was switched");
  if (integration && !(await ports.git.ancestors([integration.commit], target)).has(integration.commit))
    return refuse("the recorded integration is no longer an ancestor of its target ref");
  const bound = integration?.commit ?? target;
  const ancestors = await ports.git.ancestors(work.git.commits, bound);
  if (work.git.commits.some(c => !ancestors.has(c))) return refuse("an owned commit moved out of the selected history");
  const found = await ports.git.workCommits(work.label, pinned?.head ?? target);
  if (found.shallow) return refuse("this is a shallow clone, so the work's history may be incomplete");
  if (found.merges) return refuse("a commit of this work is a merge commit; undoing it needs a person");
  if (found.commits.some(c => !work.git.commits.includes(c)))
    return refuse("another commit uses this work's label; its ownership cannot be established, so nothing was reverted");
  if (work.git.commits.some(c => !found.commits.includes(c))) return refuse("a proven commit is absent from discovery history");
  return found.commits;
}
