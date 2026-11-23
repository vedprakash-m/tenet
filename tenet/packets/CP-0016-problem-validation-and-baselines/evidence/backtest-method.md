# Alpha.1 backtest method

Sources: plan §1, [kernel §4](../../../specs/tech-spec/kernel.md#4-alpha1-backtest), [R-216](../../../specs/prd/tooling.md#3-adoption-and-friction), and Owner decision L-0032.

## Fix the cohort before running the gate

Select 100 distinct closed historical pull requests from Tenet, Torus and one public repository. Record the public repository, time windows, eligibility criteria, per-repository counts, sort or random seed and selection steps. Choose without reference to anticipated outcomes. Freeze the manifest, data snapshot, target policy and simulated decision times before replay. Keep records and revisions as they were available at each decision point. Keep a stable repository and PR identifier for each case, and use only evidence the study may access.

For each PR, retain the applicable verdict, actual disposition, rule matches and source references. An independent adjudicator compares enforcing refusals with the frozen facts and rule. A PR counts once as a false block if any enforced refusal is independently found unwarranted under the applicable rule at that time. Advisory findings do not count. Waivers and “not useful” marks can trigger investigation, but neither establishes a false block by itself. Retain per-rule reasons and give an unassessable case an explicit status. If the sample cannot be reconstructed, report incomplete coverage and follow the kernel's complete prespecified rerun rule.

## Time active Tenet work

For each PR, use a stopwatch or timing log for active human work attributable to Tenet records and decisions. Include finding or correcting those records and handling Tenet-specific prompts or findings. Exclude ordinary review, implementation, CI waiting and breaks. Separate mixed work by its attributable segments. Record who timed it, start and stop, activity and exact duration. A completed session with no such work is a measured zero. A missing timing is unknown.

Report the overhead metric as the sum of attributable active minutes divided by 100. Include measured zeros. Calculate the gate only with complete timing coverage. The strict requirements are **fewer than two false blocks per 100 PRs** and **under two average active minutes per PR**. Report numerator, denominator, covered cases, unknowns, the per-rule breakdown and timing distribution. A claim of passing needs the complete cohort and timing evidence.

## Data sheet

| Cohort ID | Repository, PR and revision | Decision instant, policy and frozen inputs | Rule and disposition | Adjudicator, warranted/false/unassessable, reason | Active timing segments and timer | Active minutes (0 or unknown explicit) | Missing evidence |
|---|---|---|---|---|---|---:|---|
| | | | | | | | |
