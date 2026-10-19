// Every consequential control states its mechanism class and the claim stays within it (PRD 5.4, EVD-07).
// Derived from what happened; nothing here is stored. The assurance word follows the endpoint (PRD 5.3.4, TS §0.7).
import type { Endpoint, WorkContract } from "./schemas.ts";

export interface Control { control: string; class: string; note: string }

export function controlsFor(w: WorkContract, endpoint: Endpoint): { assurance: string; controls: Control[] } {
  const assurance = endpoint === "checked-local" ? "Checked local" : endpoint === "findings-only" ? "Advisory review" : "Advisory";
  const review = w.reviews.at(-1);
  const controls: Control[] = [
    { control: "check evidence", class: "deterministic", note: "receipts are bound to the exact files checked; any later edit makes them stale" },
    { control: "acceptance-test locks", class: "detected", note: "a changed locked test is found and reported; it is not prevented" },
    { control: "per-contract limits", class: "boundary-checked", note: "stops at the next boundary; cannot interrupt a running step" },
    { control: "one writer per workspace", class: "deterministic", note: "an ownership claim, plus detection of changes it did not make; unrelated editors are not controlled" },
    { control: "who edited what", class: "detected plus cooperative", note: "files you edit during the work are found by comparison; the agent declares its own edits" },
    { control: "check execution", class: "cooperative", note: "project tests run with a minimal environment and no secrets passed in, but they are not sandboxed: they can use the network and any file you can" },
    { control: "your decisions", class: "cooperative", note: "recorded as reported by the coordinator, quoted from your words" },
  ];
  if (review) {
    controls.push({
      control: "review independence", class: review.independence === "subagent-fresh" ? "cooperative" : "reduced",
      note: review.independence === "subagent-fresh" ? "the coordinator reports a fresh-context reviewer; the host dispatch is not observed here" : "the review ran in the same session, so it is not independent",
    });
  }
  return { assurance, controls };
}
