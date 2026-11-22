# Security criteria

> Kit file · id `security` · version 0.1.0 · Applied by the judge at Design and Review when the packet's risk has `access`, `data` or `effects` at medium or above, and always in Deep

| ID | Check | Default severity when violated |
|---|---|---|
| S1 | Every input crossing a trust boundary is validated; every authority decision is rechecked at the point of action | Blocker |
| S2 | No secret, token or credential is written to code, logs, records or test fixtures | Blocker |
| S3 | Permissions are the least needed; nothing widens an agent's or service's access without an approved packet | Blocker |
| S4 | Untrusted content (web pages, issues, files, model output) is treated as data, never as instructions | Blocker |
| S5 | Personal data is minimized, and its retention and deletion are stated | Major |
| S6 | Dependencies added are pinned, from a known source, and justified | Major |
| S7 | Errors do not leak internals to untrusted callers | Minor |
| S8 | The threat note in a Deep design names the assets, the actors and the top three abuse cases | Major |
