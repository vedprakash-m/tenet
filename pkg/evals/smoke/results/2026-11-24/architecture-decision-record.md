# architecture-decision-record smoke matrix

Repository: `architecture-decision-record/architecture-decision-record`

Category: docs-adr

## without-tenet-yaml

### onboard --inventory-only --json

- Exit code: 1
- Run time: 48.941 seconds
- Problem: TN-INTERNAL

```text
{"ok":false,"command":"onboard","version":"0.0.0","result":null,"errors":[{"code":"TN-INTERNAL","severity":"error","rule":null,"file":null,"line":null,"message":"Internal failure: spawn ENAMETOOLONG.","fix":"Report this defect with the command and error details."}]}
```

### check --json

- Exit code: 1
- Run time: 1.507 seconds
- Problem: TN-INTERNAL

```text
{"ok":false,"command":"tenet","version":"0.0.0","result":null,"errors":[{"code":"TN-INTERNAL","severity":"error","rule":null,"file":null,"line":null,"message":"The command could not run","fix":"Policy file tenet.yaml was not found."}]}
```

### board --json

- Exit code: 1
- Run time: 1.419 seconds
- Problem: TN-INTERNAL

```text
{"ok":false,"command":"tenet","version":"0.0.0","result":null,"errors":[{"code":"TN-INTERNAL","severity":"error","rule":null,"file":null,"line":null,"message":"The command could not run","fix":"Policy file tenet.yaml was not found."}]}
```

### context --query test --budget-tokens 2000 --json

- Exit code: 1
- Run time: 1.709 seconds
- Problem: TN-INTERNAL

```text
{"ok":false,"command":"tenet","version":"0.0.0","result":null,"errors":[{"code":"TN-INTERNAL","severity":"error","rule":null,"file":null,"line":null,"message":"The command could not run","fix":"Policy file tenet.yaml was not found."}]}
```

### verify --run-checks --json

- Exit code: 2
- Run time: 1.623 seconds
- Problem: ok

```text
{"ok":false,"command":"verify","version":"0.0.0","result":null,"errors":[{"code":"TN-USAGE-VERIFY","severity":"error","rule":null,"file":null,"line":null,"message":"Invalid usage for `tenet verify`: choose exactly one of --run-checks, --bundle, or --record.","fix":"Run `tenet verify --help` for valid arguments and flags."}]}
```

## with-minimal-tenet-yaml

### onboard --inventory-only --json

- Exit code: 1
- Run time: 30.254 seconds
- Problem: TN-INTERNAL

```text
{"ok":false,"command":"onboard","version":"0.0.0","result":null,"errors":[{"code":"TN-INTERNAL","severity":"error","rule":null,"file":null,"line":null,"message":"Internal failure: spawn ENAMETOOLONG.","fix":"Report this defect with the command and error details."}]}
```

### check --json

- Exit code: 1
- Run time: 120.033 seconds
- Problem: slow

```text

```

### board --json

- Exit code: 0
- Run time: 2.718 seconds
- Problem: ok

```text
{"ok":true,"command":"board","version":"0.0.0","result":{"schema_version":1,"as_of":"2026-11-24T04:27:35.324Z","read":{"main":"2f3d996c96d8de4b18f129e92f314687b693e221","branches":[],"records":null},"specs":[],"pending_blessings":[],"spec_debt":[]},"errors":[]}
```

### context --query test --budget-tokens 2000 --json

- Exit code: 0
- Run time: 1.664 seconds
- Problem: ok

```text
{"ok":true,"command":"context","version":"0.0.0","result":{"blessed":[],"drafts":[],"index":[],"omitted":[],"truncated":false,"rules":[{"rule":"tests-not-weakened","mode":"advise"},{"rule":"protected-surfaces","mode":"advise"},{"rule":"acceptance-passed","mode":"advise"},{"rule":"citations-valid","mode":"advise"},{"rule":"budget","mode":"advise"}]},"errors":[]}
```

### verify --run-checks --json

- Exit code: 2
- Run time: 1.506 seconds
- Problem: ok

```text
{"ok":false,"command":"verify","version":"0.0.0","result":null,"errors":[{"code":"TN-USAGE-VERIFY","severity":"error","rule":null,"file":null,"line":null,"message":"Invalid usage for `tenet verify`: choose exactly one of --run-checks, --bundle, or --record.","fix":"Run `tenet verify --help` for valid arguments and flags."}]}
```

