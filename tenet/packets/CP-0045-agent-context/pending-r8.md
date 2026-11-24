# CP-0045 pending round 8

## Inspector proving remains external

The pinned MCP Inspector is not installed in this workspace, and this machine
cannot supply the required macOS and Linux evidence. The scripted stdio tests now
load every `pkg/conformance/alg-10/` case, exercise the CLI JSON incompatibility,
and check MCP positional validation. Inspector evidence still has to be named
and captured on all three platforms for both the committed entry and the Windows
local form.
