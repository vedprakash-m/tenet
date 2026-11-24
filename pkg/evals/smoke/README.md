# Tenet smoke matrix

This directory contains an npm-free CLI smoke matrix.

Run after each merge:

```sh
node pkg/evals/smoke/run.mjs --cli Q:\Ved\Pers\tenet\dist\cli.js --out pkg/evals/smoke/results\2026-11-24
```

The runner requires only Node.js built-ins. It creates throwaway clones under
`Q:\Ved\Pers\backtest-clones\smoke`, and never runs commands in the original clones.
It records no-policy and minimal-policy runs, then writes repository markdown files,
`SUMMARY.md`, and `comparison.md`.
