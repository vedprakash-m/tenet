# The Tenet kit

This folder is the kit: everything here ships in the package and is vendored, one to one, into each project at `.tenet/kit/` (tech spec §3, §12). Agents read it there. Content the CLI needs but agents never read lives in [`../pkg/`](../pkg/) and is not vendored.

| Path | What | State at 0.1.0-draft |
|---|---|---|
| [TENET.md](TENET.md) | The normative standard | Draft |
| [CHANGELOG.md](CHANGELOG.md) | Added, changed, deprecated and removed rules per release | Started |
| [schemas/](schemas/) | JSON Schemas (draft 2020-12) | `packet`, `agent`, `tenet-profile` drafted; the rest in CP-0004 |
| [defaults/profile.yaml](defaults/profile.yaml) | Defaults merged under every `tenet.yaml` | Drafted |
| [templates/](templates/) | Document templates | vision, definition, packet plan, escalation, ledger entry, holdout scenario, agent drafted; the rest in CP-0012 |
| [agents/judge-protocol.md](agents/judge-protocol.md) | The shared review protocol | Drafted |
| [agents/roles/](agents/roles/) | Reference agent definitions | shaper, builder, verifier, judge drafted; the rest of the roster in CP-0012 |
| [agents/criteria/](agents/criteria/) | Specialist criteria for the judge | architecture, security, product, quality, experience drafted |
| [loops/station-loop.yaml](loops/station-loop.yaml) | The engine-neutral station loop | Drafted |
| `kit.json` | Generated at release: version and SHA-256 of every file | Release build |

Placeholders such as `<Owner>` and `<model-a>` are bound by each project's profile or overlays. `${records}` in agent path rules is the project's records folder (`tenet/` by default).
