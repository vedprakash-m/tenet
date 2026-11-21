// Admitted committed repository facts for CON-07. It reads only HEAD blobs through Git; working/index bytes never enter recovery.
import type { Ports } from "../ports/types.ts";

export type LockProposal = { id: string; path: string; hash: string; commit: string };
export type RepositoryRecords = { ids: string[]; locks: LockProposal[] };

const SHARED_ID = /(?:REQ|EX|INV|CNS|ASM|DEC|DEF|PLN)-\d{3,}-[a-z0-9]{3}(?:\.\d+)?/;
const isTestPath = (path: string) =>
  path.includes("/__tests__/") || /(?:^|\/)(?:test|tests|spec)\//.test(path) ||
  /\.(?:test|spec)\.[A-Za-z0-9_-]+$/.test(path);

export const unique = (values: readonly string[]) => [...new Set(values)].sort();

export async function repositoryRecords(ports: Ports): Promise<RepositoryRecords> {
  const probe = await ports.git.probe();
  if (!probe.isRepo || probe.shadow || !probe.head) return { ids: [], locks: [] };
  const commit = probe.head, tree = await ports.git.treeAt(commit);
  const ids: string[] = [], locks: LockProposal[] = [];
  for (const entry of tree) {
    const decision = entry.path.startsWith("docs/decisions/") && entry.path.endsWith(".md");
    if (!decision && !isTestPath(entry.path)) continue;
    const text = await ports.git.showAtBounded(commit, entry.path, 1024 * 1024);
    if (text === null) continue;
    if (decision) {
      const match = /^id:\s*(\S+)\s*$/m.exec(text);
      if (match && SHARED_ID.test(match[1]!)) ids.push(match[1]!);
      continue;
    }
    for (const found of text.matchAll(/@tenet\s+([A-Z]+-\d{3,}-[a-z0-9]{3}(?:\.\d+)?)/g)) {
      const id = found[1]!;
      if (!SHARED_ID.test(id)) continue;
      ids.push(id);
      locks.push({ id, path: entry.path, hash: entry.blob, commit });
    }
  }
  return {
    ids: unique(ids),
    locks: unique(locks.map((item) => `${item.id}\u001f${item.path}\u001f${item.hash}\u001f${item.commit}`))
      .map((item) => {
        const [id, path, hash, commit] = item.split("\u001f");
        return { id: id!, path: path!, hash: hash!, commit: commit! };
      }),
  };
}
