# Tenet performance benchmark

This benchmark measures repository-size growth in the Tenet CLI.

`generate.mjs` creates a deterministic Git repository with:

- `n` Markdown files under nested `content/<bucket>/<bucket>/` folders;
- `size` bytes of fixed-seed content per Markdown file;
- `k` specification documents with real Tenet front matter;
- a minimal `tenet.yaml` listing only the `k` specification documents;
- one initial commit.

```sh
node pkg/evals/bench/generate.mjs --out Q:\Ved\Pers\backtest-clones\bench\fixture --docs 1000 --size 1024 --specs 5
```

`run.mjs` creates 1k, 5k, 10k, and 30k Markdown-file fixtures outside the repository,
keeps five specification documents in every fixture, runs four CLI commands three times,
and writes medians to `results/<date>/RESULTS.md`.

```sh
node pkg/evals/bench/run.mjs --cli Q:\Ved\Pers\tenet\dist\cli.js --out pkg/evals\bench\results
```

The gate implies:

- the first findings should appear within 10 minutes;
- `check` should not grow meaningfully with Markdown files outside `specs.documents`;
- discovery should be bounded by actual specification inputs rather than the whole repository.

RESULTS.md records exit codes and replaces timed medians with `FAILED` whenever a run exits
non-zero or prints `TN-INTERNAL`. A failed cell is not an elapsed-time result.
