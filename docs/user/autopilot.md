<!-- DRAFT. Source: specs/tech-spec.md section 11.4, specs/ux-spec.md section 9. -->
# The Autopilot limit

Copilot's Autopilot answers some questions for you. Tenet cannot detect it.

## What goes wrong

Tenet records decisions as coming from you. Under Autopilot, a question that the host shows as a native picker can be answered automatically, and the answer reaches Tenet in the same form as yours. Tenet has no way to tell them apart. So under Autopilot:

- Every decision record is **unverifiable**. Tenet labels how each answer was captured, and a labelled answer is not proof that a person gave it.
- A picker answer is never evidence that you approved something.

## What Tenet does about it

- Questions about authority are asked in **plain chat** and Tenet ends its turn, so a picker cannot answer them. These are: widening scope, protected paths, remote actions, destructive actions, accepting a risk or a shortcut, a check that may send project content out, and owner acceptance.
- Routine choices (for example which of two equivalent options) may use pickers.
- When the approval mode is auto-approve or unknown (it is recorded as unknown today), remote changes, sending project content out and destructive actions get a chat question first.
- Every answer is tied to the facts the question was asked about. If the facts change, Tenet asks again.

## What this means for you

- If a decision must be provably yours, do not use Autopilot for that work.
- Tenet's chat questions end with a short reply cue. Answer them yourself.
- This is a limit of what Tenet can observe, not a bug that a later version is promised to fix.

Whether a bundled MCP front-end could capture answers more reliably is an open question (plan spike SP-12) and not part of the current claim.
