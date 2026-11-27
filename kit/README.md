# The Tenet kit

This folder is the kit: everything here ships in `@vedprakash-m/tenet` (`kit/`) and is loaded from the installed package by `tenet.lock` (or copied into `.tenet/kit/` only with `init --vendor`). Content the CLI needs internally or for evaluation lives in [`../pkg/`](../pkg/) and is never vendored.

| Path | What | State at 0.1.0-alpha.0 |
|---|---|---|
| [TENET.md](TENET.md) | The normative standard | In transition (rewritten in M0) |
| [CHANGELOG.md](CHANGELOG.md) | Added, changed, deprecated and removed rules per release | Started |
| [schemas/](schemas/) | JSON Schemas (draft 2020-12) | `packet`, `agent`, `tenet-profile` drafted; alpha.0 schemas arrive next |
| [defaults/tenet.yaml](defaults/tenet.yaml) | Alpha.0 defaults merged under `tenet.yaml` | Alpha.0 |
| [packs/minimal/pack.yaml](packs/minimal/pack.yaml) | Default pull-request native lifecycle pack | Alpha.0 subset |
| [practices/default.md](practices/default.md) | Default working rules embedded in `AGENTS.md` | Alpha.0 |
| [templates/](templates/) | Document and prompt templates (`intent`, `vision`, `requirements`, `design`, `experience`, `plan`, `pull-request`, `agents-block`, `escalation`) | Alpha.0 |
| [agents/](agents/) | Reference agent cards (`drafter`, `spec-reviewer` in alpha.0; careful-lane cards later) | Alpha.0 |
| [skills/](skills/) | Open agent-skills (`tenet-draft-specs`, `tenet-work-a-change`, `tenet-review-with-findings`) | Alpha.0 |
| `kit.json` | Generated at release: version and SHA-256 of every file | Release build |

Placeholders such as `<owner>` and `{records}` are filled by each project (`paths.records` defaults to `tenet`).
