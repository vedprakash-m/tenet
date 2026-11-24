# CP-0053 · Round 8 pending

No decision is pending for B1–B5 or S1.

- The shared board schema now exports the same alpha.0 shape as the command
  result schema and generated types are current.
- The board loader discovers the full records ladder, then applies configured
  document metadata.
- Missing or invalid blessed `recorded` metadata is represented as `self`,
  matching the alpha.0 self-recorded verification default.
- Specification budget counts normalize CRLF and LF before measuring.
- Board usage failures use the canonical wildcard message.
- The independent board cases run from their own inputs and expectations.
