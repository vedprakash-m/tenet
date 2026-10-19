---
agent: tenet
description: Review code without changing anything: a document, uncommitted changes, a branch or files.
---
Run `tenet review` for the scope below, dispatch `tenet-reviewer` on the manifest it returns, and report the
findings. This changes nothing in the project: no files, no Git objects, no checks or scripts run.

${input:scope}
