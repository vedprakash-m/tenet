# CP-0045 pending round 4

# CP-0045 pending round 4

## Shared blocker

The command modules cannot be registered with the current shared architecture.
`src/commands/index.ts` imports command files, but commands cannot import
`src/cli.ts` to self-register because the enforced dependency map forbids
commands from importing the CLI. Resolving this requires a shared change to the
CLI/index registration boundary.

The architecture table also excludes `src/mcp/` from the allowed command
dependencies, although the `mcp` command must invoke the MCP server. That shared
registration and dependency conflict must be resolved before both CP-0045
command modules are executable.

CP-0045's context/MCP logic, schemas and direct tests have no outstanding
packet-local defects.
