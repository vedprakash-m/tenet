// `review`: a review-only manifest for the working tree. Stateless: nothing is written to the project, including
// Git objects and traces (TS §6.3). The manifest goes to the OS temp directory and the response names it.
import { KernelError } from "../core/errors.ts";
import { netAttention, reviewOnlyManifest } from "../core/review.ts";
import { ReviewInput } from "../core/schemas.ts";
import { nx } from "./common.ts";
import type { Verb } from "../pipeline.ts";

export const review: Verb<ReviewInput> = {
  name: "review",
  schema: ReviewInput,
  class: () => "stateless",

  async run(ports, _s, input) {
    if (input.scope !== "working-tree" || input.base) throw new KernelError("capability-missing", "only working-tree review against HEAD is implemented; branch, file, document and explicit-base review are unavailable", { exit: 2 });
    const probe = await ports.git.probe();
    if (!probe.isRepo) throw new KernelError("capability-missing", "review needs a Git repository to compare against", { exit: 2 });
    const inv = await ports.git.inventory([]);
    const base = probe.head;
    const changes = await ports.git.changes(base, inv.status.map((s) => s.path), ports.stack.classify);
    const attention = netAttention(changes, ports.stack.patterns).map((a) => ({ ...a }));
    const m = reviewOnlyManifest(changes, attention, "Review the change for correctness, structure and security. Return findings with path:line evidence.", base);
    const path = ports.store.writeArtifact(ports.store.tempDir("review"), `${m.hash}.json`, m.text);
    return {
      resp: {
        next: [nx("review", "Dispatch a fresh-context reviewer on the manifest; this call changed nothing in the project.", true)],
        data: { manifest: path, hash: m.hash, tokens: m.tokens, files: changes.length, attention: attention.length, uninspected: base === null ? "the repository has no commits yet" : null },
      },
    };
  },
};
