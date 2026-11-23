# Independent CP-0044 fixtures

The round 2 reviewer authored the cases listed in the ALG-02, ALG-03, ALG-04 and ALG-14 README tables apart from CP-0044's builder, using main at `1225d8d` as the specification baseline. No CP-0044 implementation supplied their expected results.

The builder may add cases. The builder must never change these independent case inputs, expected results or their README entries. If an independent case disagrees with the contract, send it to the reviewer or the Owner for resolution through the governed change process.

Each case supplies input and an expected JSON projection. A projection compares every field present, exact list membership and order, and exact scalar values. Extra fields omitted by the projection are outside that case's assertion. Digest expectations are literal prefixed SHA-256 values over the explicitly normalized UTF-8 content. Git cases use synthetic snapshots and have no dependency on production records.

# Independent wave A0-4 fixtures

The round 3 reviewer authored the [check](check/README.md), [ALG-10 context and MCP](alg-10/README.md) and [specification board](board/README.md) suites against main at `1729379`, separately from the future builders of CP-0009, CP-0045 and CP-0053. The same ownership rule applies. A builder may add cases and must never change these inputs, expectations or README rows.

Each suite README defines how to run and compare its cases. Where a field or complete rendering is undecided, a projection asserts only the specified behavior. The READMEs define the few reserved projection markers and link to the owning packet's proposals. The fixture snapshots and checked-in expected display files are synthetic conformance inputs and oracles.

# Independent CP-0010 install fixtures

The round 5 reviewer authored the [install suite](install/README.md) from the CP-0010 contract and its named specifications at `18bc39f`, apart from the future installer builder. The same ownership rule applies. A builder may add cases and must never change these inputs, expectations, harness settings or README rows. The fixture README lists the expected files that are intentionally absent until the owning packet resolves the linked questions.
