---
id: <id>
version: 0.1.0
role: <role>
kind: creator                    # creator | critic | verifier | coordinator | steward
status: draft                    # draft | candidate | qualified | active | probation | deprecated | retired
sponsor: "<Owner>"
description: <one sentence>
stations: [<station>]
lanes: [quick, standard, deep]
model: {preferred: "<model>", allowed: ["<model>"], effort: medium}
tools: [read]                    # allowlist; everything else is denied
paths:
  write: []
  deny_read: ["${records}/holdout/**"]
  deny_write: ["${records}/vision.md", "${records}/specs/**", "${records}/ledger/**", ".tenet/**", "tenet.yaml"]
network: none
budget: {turns: 30, tool_calls: 100, wall_minutes: 45, tokens: 1000000}
output_schema: schemas/<id>-result.json
criteria: []                     # critics only
handoff: []
eval_suite: evals/<id>/
qualified: []
---
## Purpose

## Inputs

## Outputs

## What good looks like

## What this agent does not do

## Handoff

## When to stop and escalate
