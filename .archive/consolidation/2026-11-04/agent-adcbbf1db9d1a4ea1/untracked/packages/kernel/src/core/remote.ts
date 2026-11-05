// Remote actions (TS §10.6, GIT-05): what a user's agreement to push is bound to, what counts as a change, and how an
// interrupted push is judged from what the remote shows. Pure: the Git reads that feed these live behind the git port.
import { hashOf } from "./ids.ts";

/** Remote, URL (without credentials), branch on the remote and the exact commit the user agreed to. */
export interface Binding { name: string; url: string; branch: string; commit: string }

export const short = (commit: string): string => commit.slice(0, 7);
export const bindingHash = (b: Binding): string => hashOf({ name: b.name, url: b.url, branch: b.branch, commit: b.commit }).slice(0, 12);

export const validRemoteName = (n: string): boolean => /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(n);
/** A branch name in the plain subset of Git's rules; anything else is refused rather than guessed at. */
export const validBranch = (b: string): boolean =>
  /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(b) && !/\.\.|\/\/|\/\.|[./]$|\.lock(\/|$)/.test(b);

/** One phrase per fact that differs, for telling the user what changed since they agreed. */
export function changedFrom(bound: Binding, live: Binding): string[] {
  return [
    ...(live.name !== bound.name ? [`this call names remote ${live.name}`] : []),
    ...(live.url !== bound.url ? [live.url ? `the URL of ${bound.name} changed` : `${bound.name} is no longer a remote here`] : []),
    ...(live.branch !== bound.branch ? [`this call names branch ${live.branch}`] : []),
    ...(live.commit !== bound.commit ? [`the work's latest commit is now ${short(live.commit)}`] : []),
  ];
}

/** What Git said about the push: it succeeded, it exited with an error, or it was cut off (timeout, signal, a dead kernel). */
export type Pushed = "ok" | "rejected" | "interrupted";
/** What `git ls-remote` showed for the branch, or null when the remote could not be read. */
export type Seen = { commit: string | null } | null;

/** The remote is the evidence. A branch at the commit means it landed; otherwise Git's own error or silence decides. */
export function settlePush(pushed: Pushed, seen: Seen, commit: string): "completed" | "not-performed" | "uncertain" {
  if (seen?.commit === commit) return "completed";
  if (pushed === "rejected") return "not-performed";
  if (pushed === "interrupted" && seen && seen.commit === null) return "not-performed";
  return "uncertain";
}
