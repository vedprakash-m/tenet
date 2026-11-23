# Proposals for the Owner and integration tracks

This branch starts from `efb8477`. The newer shared drafts were consulted as references. Apply the following against the integration baseline that contains L-0024 through L-0030.

1. **Technical specification, header parts list**. Add `[kernel](tech-spec/kernel.md) (kernel algorithms and interface details)` and link any continuation the kernel part names. Keep the existing contracts, algorithms, CI, agents, evidence and onboarding links.
2. **Plan §0, CP-0015 row**. Once the integration baseline contains the Track 1 submission, use: “Draft kernel, reference cases, evaluator fixture and build contracts submitted in CP-0015. Resolve the packet’s open decisions, then hand the matching baseline to CP-0058.” Update readiness only after independent review and Owner decisions.
3. **Plan §4, evaluator trial**. Use: “Use `pkg/conformance/evaluator-trial/history.yaml` as the only input history. The scorer compares each session's projected output to `expected.json` and to the other session byte for byte after canonical serialization. Record any rule or input the model had to invent.” The trial execution stays with CP-0058.
4. **Agents technical specification**. Apply the branch's `agents.md` contribution at §5 through the end of §6. Retain the integration baseline's front matter and §§1–4.
5. **Repository profile**. Review and, only if approved, apply the packet's `proposed-tenet.yaml` to the root `tenet.yaml`. This is an alpha.0 self-hosting proposal. No signing key or verified merge protection has been demonstrated for this profile. Fill the checks from actual bootstrap commands before relying on them, and explicitly adjudicate every old field whose behavior is being retired or migrated.

## Decisions still needed

- Decide which legacy stop conditions, limits, holds and release practices should be expressed in later supported fields or pack defaults. The minimal profile avoids carrying legacy fields into a schema that rejects them.
- Confirm the standard version range, the Owner's forge principal and the role label before adopting this profile. Configure separately authorized identities and evidence before any stronger level.
- L-0030 leaves hardware-backed human presence, external fork behavior and required-check outcomes under real branch protection open. Retain the documented guarantee boundaries until those checks run.
