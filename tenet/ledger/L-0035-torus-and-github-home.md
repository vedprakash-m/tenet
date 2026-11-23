---
id: L-0035
kind: decision
date: 2026-11-23
packet: CP-0016
title: "Torus joins as the first adopter, not the backtest; the GitHub home exists"
---
# L-0035 · Torus as first adopter; the GitHub home exists

## Context

L-0033 fixed the backtest cohort to start with every usable pull request from this repository, Torus and tenet-copilot, then fill from microsoft/BotFramework-WebChat. The Owner then:
- said Torus is at `Q:\Ved\Pers\torus`, still only at the specification stage, and will be built with Tenet once Tenet ships
- asked for everything that speeds up shipping, including creating the GitHub repository

## Decision or event

- **Torus has no history to backtest.** It is not a git repository and has no pull requests, so it contributes 0 cases. This repository has none yet either: work has merged locally. The cohort is tenet-copilot's usable pull requests, then WebChat's ranked candidates up to 100. It is frozen once round 2's dataset is reviewed.
- **Torus becomes the first adopter after alpha.0.** Installing Tenet in a project that has specifications but no code tests onboarding's "specs first" path.
- **GitHub home:** `vedprakash-m/tenet` was created **private** on 2026-11-23, and `main` was pushed. CI runs on Linux, Windows and macOS on every push. It becomes public on the alpha.0 release day.
- **From round 2 on, tracks merge through pull requests** on this repository. Each change then gets three-platform CI before it merges, and Tenet's own pull-request history starts building up.

## Evidence

The Owner's message of 2026-11-23; `Q:\Ved\Pers\torus` has no `.git`; `gh repo create` and the push.

## Consequences

- The alpha.1 backtest no longer waits on Torus.
- Commit authorship should be checked before the repository goes public: commits carry the author's work address.
