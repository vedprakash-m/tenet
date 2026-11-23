# Quality criteria

> Kit file · id `quality` · version 0.1.0 · Applied by the judge at Build and Review in every lane

| ID | Check | Default severity when violated |
|---|---|---|
| Q1 | Tests assert behavior named in the acceptance basis, not implementation details | Major |
| Q2 | No test was weakened, skipped or deleted without an approved change to the acceptance basis | Blocker |
| Q3 | Boundary and negative examples have tests | Major |
| Q4 | Code follows the project's stated conventions; names say what things are | Minor |
| Q5 | No dead code, commented-out code or unexplained TODO is introduced | Minor |
| Q6 | Every claim in the result has an evidence reference; unknowns are reported as unknown | Major |
| Q7 | The diff is limited to the task's scope | Major |
