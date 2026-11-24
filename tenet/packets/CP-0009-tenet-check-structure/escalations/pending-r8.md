# CP-0009 · Pending round 8 decisions

## Citation oracle versus policy-mode contradiction

The checked-in `pkg/conformance/check` citation cases specify
`severity: "error"` for a direct `check` under `level: "observe"`. The policy
mode table otherwise maps `citations-valid` to `"advise"` at observe, while
`answers-r4.md` allows direct validation to report structural errors and the
cases themselves are byte-level CP-0009 acceptance inputs.

CP-0009 therefore keeps direct `check` citation findings as errors and applies
the effective policy mode only for CI/base evaluation. **Proposal:** the Owner
should confirm this split and align the policy contract wording in its owning
packet; the independent cases are not changed.
