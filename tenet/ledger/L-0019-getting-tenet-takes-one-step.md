---
id: L-0019
kind: decision
date: 2026-11-23
packet: CP-0001
title: "Getting Tenet takes one step, from the GitHub page"
---
# L-0019 · Getting Tenet takes one step, from the GitHub page

## Context

The Owner found the UX specification still unclear on getting Tenet from GitHub, the first step and the one that decides adoption. The specification began at `npx tenet init`, assumed a published npm package, and said nothing about the GitHub page people land on. That page (the repository README) still described the superseded design: thirteen stations, a vendored kit, `adopt`.

## Decision or event

1. UX specification **Part 0: get Tenet** comes before the two starting paths. It states that there is no account or service, what is needed, and four ways in, each about a minute:
   - a prompt to paste into a coding agent (the easiest)
   - `npx tenet init`
   - **Use this template** on a `tenet-starter` repository for a new project
   - standalone downloads from 0.1.x

   It also covers running straight from a GitHub tag before the npm release, how to verify what you got, and what the GitHub page's first screen must hold.
2. Requirement R-221 (tooling): getting Tenet takes one step, verifiable, with no account and no script piped into a shell. The tech spec adds installing from a GitHub tag, the template repository and the README's first screen; CP-0013 builds the first contact, CP-0024 releases it, and CP-0002 also names the GitHub owner, repository and template.
3. The README is rewritten to match: the promise, the four ways in, the files Tenet adds, how to remove it, then how it works and the documents.

## Evidence

The Owner's reading of the UX specification after L-0018; the README as it stood.

## Consequences

The README's first screen and UX Part 0 must stay identical in substance; CP-0013's quick start tests every way in from the GitHub page.
