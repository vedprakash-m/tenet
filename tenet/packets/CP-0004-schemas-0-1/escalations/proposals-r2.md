# CP-0004 round 2 proposals

## Agent-card outputs contradiction

Agents.md §1 says the following fields are required for every agent card:

> “Required: `name`, `version`, `role`, `kind` (`creator` or `critic`),
> `purpose`, `inputs` `{spec_levels, sections, artifacts}`, `outputs`
> `{result_schema, writes}`.”

The required `kit/agents/spec-reviewer.md` reference is a critic card, but its
`outputs` object contains only:

> `result_schema: review`

It omits `outputs.writes` and must still validate as the reference. Must
critics also gain `outputs.writes`, or is the required `outputs.writes` shape
creator-only?

The implemented `agent-card.json` follows the existing critic reference until
the Owner resolves this contradiction: `result_schema` is required for both
kinds, while `writes` is required only for creators.

## Schema registry ownership contradiction

The CP-0004 plan owns `src/core/schema.ts`, but the user's narrowed Owns says:

> “Never edit src/core/schema.ts because user's explicit Owns excludes it”

Must `src/core/schema.ts` be updated so its validator registry includes `pack`
and `agent-card` despite that narrowed scope?

## Proposal

Keep this round limited to the two schemas, direct Ajv schema tests, generated
types, and packet records. Escalate registration to the Owner because editing
the registry is outside the assigned file scope. Do not edit `schema.ts`,
`E-0001.md`, or any other out-of-scope file in this round.
