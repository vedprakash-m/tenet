---
agent: tenet
description: "Review uncommitted code without changing anything."
---
Only working-tree review against HEAD is implemented. For another scope, report that limitation. Run `tenet review` for uncommitted changes below, dispatch `tenet-reviewer` on the manifest it returns, and report the
findings. This changes nothing in the project: no files, no Git objects, no checks or scripts run.

${input:scope}
