# Rollback Runbook

## Steps
1. Freeze active deploys.
2. Revert to previous signed tag.
3. Verify `/readyz` returns `ready: true`.
