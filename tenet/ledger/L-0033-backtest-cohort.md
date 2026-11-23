---
id: L-0033
kind: decision
date: 2026-11-23
packet: CP-0016
title: "Backtest cohort: this repository, Torus, tenet-copilot and BotFramework-WebChat"
---
# L-0033 · Backtest cohort

## Context

Alpha.1's build gate is a backtest over 100 past pull requests (L-0029, L-0032). The cohort needed a public repository besides this one and Torus. `vedprakash-m/tenet-copilot` is public TypeScript with CI, but it has 22 merged pull requests (20 by the Owner, 2 by Dependabot): too few, and too much from one author, to measure false blocks on other people's work.

## Decision or event

The Owner chose to use both repositories:
- **`vedprakash-m/tenet-copilot`:** every usable pull request. It is also a dogfooding target.
- **`microsoft/BotFramework-WebChat`:** an independent, active TypeScript project with real CI, a long human pull-request history and merged Copilot-agent pull requests. It fills the cohort to 100.

The cohort takes every usable pull request from this repository, Torus and tenet-copilot first, then fills from WebChat, recording each pull request's source. It is frozen before any alpha.1 measurement (the method is in CP-0016's `backtest-method.md`).

## Evidence

A repository check and a search of merged Copilot-agent pull requests, in the session of 2026-11-23.

## Consequences

- Collecting the dataset is mechanical and is planned for a high-volume model; frozen, it becomes alpha.1's backtest fixture.
