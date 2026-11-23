# Round 2 example proposals

The examples check reports these four locations. Each location has a matching entry in `scripts/examples-known.json`. Apply the corrections in the owning packets and remove each entry once the example passes.

| Example | Basis | Reason | Proposal |
|---|---|---|---|
| `tenet/specs/tech-spec/agents.md:169` | Agents §5 and plan alpha.1, CP-0049 | The worked define loop parses as YAML. Its contracted `loop` schema is not registered. | Register `kit/schemas/loop.json` in CP-0049 and prove the define loop validates. |
| `tenet/specs/tech-spec/agents.md:184` | Agents §5 and plan alpha.1, CP-0049 | The worked build loop parses as YAML. Its contracted `loop` schema is not registered. | Register `kit/schemas/loop.json` in CP-0049 and prove the build loop validates. |
| `tenet/specs/tech-spec/contracts.md:26` | Contracts §2 | The inline annotation becomes part of the heading. The parser requires the exact heading text. The other aligned annotations also appear as literal content. | Move the annotations outside the fence and keep the heading, requirement IDs and acceptance item verbatim. |
| `tenet/specs/tech-spec/contracts.md:37` | Contracts §3 and `kit/schemas/spec-front-matter.json` | The literal digests for the section, its blessing and its anchor do not have 64 lowercase hexadecimal digits. | Give those three digests concrete schema-valid SHA-256 values. |
