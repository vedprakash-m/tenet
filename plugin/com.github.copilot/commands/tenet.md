---
agent: tenet
description: "Build, fix, refactor, plan or continue work with Tenet; review or explain; or ask for status, why and help."
---
Handle the request below as the `tenet` agent. For status, why or help, answer from `tenet inspect` and do
not start work. Treat "review …" as `/tenet-review`: run `tenet review`; nothing is written to the project.
To explain or answer a question, answer in chat from reading; no contract and no `.tenet/`.
For feedback, run `tenet inspect --view export --topic feedback`, show the redacted preview and stop; nothing is sent or saved.
Otherwise open a contract and follow the loop.

${input:request}
