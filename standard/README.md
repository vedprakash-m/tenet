# The Tenet standard and kit

Everything in this folder ships in the package and is vendored into subscribing projects at `.tenet/kit/` (tech spec §3, §12).

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
| `evals/` | Reference evaluation suites | M5 |
| `migrations/` | Upgrade migrations | M4 |
| `conformance/` | Conformance tests and fixtures | M4 |

Placeholders such as `<Owner>` and `<model-a>` are bound by each project's profile or overlays.
