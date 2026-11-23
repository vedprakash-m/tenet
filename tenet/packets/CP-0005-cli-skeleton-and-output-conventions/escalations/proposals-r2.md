# Round 2 canonical JSON proposal

Contracts §11 requires canonical JSON. RFC 8785 §3.2.2.2 requires canonicalization to stop on a lone UTF-16 surrogate; the rule applies to object member names as well as string values. See [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html#section-3.2.2.2).

Contracts §13 has no dedicated code for this failure. CP-0005 uses the existing structural code `TN-SCHEMA`. If callers need to distinguish invalid Unicode from other schema errors, add `TN-JCS-UNICODE` to §13 as a structural issue (exit 1), with the fix “Replace the unpaired surrogate with valid Unicode.” Update the canonicalizer and its vectors together if the Owner approves the change.
