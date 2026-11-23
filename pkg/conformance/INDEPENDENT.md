# Independent CP-0044 fixtures

The round 2 reviewer authored the cases listed in the ALG-02, ALG-03, ALG-04 and ALG-14 README tables apart from CP-0044's builder, using main at `1225d8d` as the specification baseline. No CP-0044 implementation supplied their expected results.

The builder may add cases. The builder must never change these independent case inputs, expected results or their README entries. If an independent case disagrees with the contract, send it to the reviewer or the Owner for resolution through the governed change process.

Each case supplies input and an expected JSON projection. A projection compares every field present, exact list membership and order, and exact scalar values. Extra fields omitted by the projection are outside that case's assertion. Digest expectations are literal prefixed SHA-256 values over the explicitly normalized UTF-8 content. Git cases use synthetic snapshots and have no dependency on production records.
