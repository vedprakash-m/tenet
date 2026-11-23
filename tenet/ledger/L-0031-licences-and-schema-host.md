---
id: L-0031
kind: decision
date: 2026-11-23
packet: CP-0002
title: "Licences and schema host"
---
# L-0031 · Licences and schema host

## Context

Bootstrap (CP-0003) and any npm publish need a licence, and the schemas (CP-0004) need a stable `$id` host (open question OQ-04). Tenet is both code and a standard meant to be implemented by others.

## Decision or event

The Owner chose:
- **Licences:**
  - **Code**, and machine-readable kit and pkg files: **Apache-2.0** (`LICENSE`). It is permissive and carries an explicit patent grant.
  - **The standard and documentation text:** **CC BY 4.0** (`LICENSE-docs`). Anyone may copy and adapt the text with attribution.
- **Schema IDs:** `https://vedprakash-m.github.io/tenet/schemas/<minor>/<name>.json`, published from `kit/schemas/` through GitHub Pages at each release. A custom domain can be added later with a redirect.

The alternatives considered were Apache-2.0 for everything, MIT with CC BY, copyleft, a custom domain, and unpkg.

## Evidence

The Owner's answers in the session of 2026-11-23.

## Consequences

- OQ-04 is closed, and DEC-58 is added. The README, contracts §1 and plan §0 are updated.
- `package.json` uses `"license": "Apache-2.0"`.
