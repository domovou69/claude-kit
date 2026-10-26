# Plan — <project name>

<One or two sentences: what the project answers or ships.>

Started <date>. Related projects: <links, or "none">. The live status of the stages and of the Definition of Done is in
[docs/plan.json](docs/plan.json), shown as the plan page; this file is the plan as agreed.

## 0. Health check

| Component | Latest release | Deprecation notices | Vendor direction | Verdict |
| --- | --- | --- | --- | --- |
| <key technology> | <version, date> | <quote with link, or "none found"> | <what replaces it, if anything> | <green / yellow / red, horizon in years> |
| <its dependency> | | | | |

On yellow or red: 2–3 alternatives below and the user's decision before stage 1.

## Why and what next

- Goal: <the question or the product>.
- If <outcome A>: <next step>.
- If <outcome B>: <next step>.

## Definition of Done

Filled in before the first line of code. Every goal is a number the project can measure, with the highest value it can
reach. Reaching the target is the stop: no stage, review round or fix adds scope after that.

| Goal | How it is measured | Now | Target | Ceiling |
| --- | --- | --- | --- | --- |
| <what the user can see, e.g. "locators converted correctly"> | <command or report, on which data> | <value> | <value> | <the highest value possible, and why> |

The same numbers go to `dod` in `docs/plan.json`. When every target is reached, the project moves to maintenance mode
(below). A goal that cannot be measured is not a goal yet: write how it will be.

## Out of scope

What this project will not do, even if it comes up. A finding that needs one of these goes to
`docs/known-issues.md`, not into a stage.

- <not doing this>: <why>.

## Scope

- In: <…>.

## Architecture before code

Decided here, so that the first fix does not become the third copy of the same logic.

- Modules and their borders: <module → what it owns, what it never does>.
- Shared primitives (one place for each; a second copy is a defect): <e.g. the scanner for quotes and brackets, the
  validator, the report format>.
- Data flow: <input → steps → output; what is checked after each step>.
- What stays out of the core: <file system, network, the CLI>.

## Budgets

| Budget | Limit | When it is hit |
| --- | --- | --- |
| Stages | <N stages, ≈H h> | <a new stage needs a "yes" and a place in the plan> |
| Review rounds | One per change set; the fixes of a review are reviewed again only when one of them is P1 | <the rest goes to known-issues.md> |
| One window | <≈X % of one 5-hour window per stage> | <split the stage, or update memory and continue in a new window> |

## Constraints

- Host: <machine, OS; what is installed and what is not>.
- Network: <normal / mobile hotspot: warn before downloads over N MB>.
- Budget: <usage window per day, money for API calls, if any>.
- Public repository: <yes / no>. Local-only values (device ids, signing ids, ports in use) live in <git-ignored file>.

## Kit plugins

| Plugin / skill | What it gives this project | Scope |
| --- | --- | --- |
| <plugin:skill> | <one line> | <user / project> |

## Lessons from the previous project

| # | What it did | What it cost | Here |
| --- | --- | --- | --- |
| 1 | <step or order taken over> | <rework rounds, fix PRs, reruns> | <what this plan does instead> |

## Stages

Times are wall clock; "window" is the share of one 5-hour usage window the stage costs (background runs and downloads
cost little window but take wall time). Each stage needs a "yes" before it starts.

| # | Stage | Output | Wall time | Window | Status |
| --- | --- | --- | --- | --- | --- |
| 0 | <scaffold: repository settings, CI, packaging basics> | <files, checks green> | <≈N min> | <≈X %> | <planned> |
| 1 | <…> | <…> | <≈N min> | <≈X %> | <planned> |
| | Total | | <≈N h over M sessions> | <≈X % of one window> | |

Cheaper path: <which stages to drop or shrink, and what is lost>.

## Stage-end criterion

At the end of every stage, one question: **did a metric in the Definition of Done move?**

- Yes: record the new value in `docs/plan.json`, then go on.
- No: close the stage. Whatever it found goes to `docs/known-issues.md` with a priority, and nothing from it becomes a
  new stage unless it is a P1.

## Maintenance mode

The project is finished when every Definition of Done target is reached (or the ceiling is, and the rest is out of
reach). After that, work starts only on:

- <a trigger from outside, e.g. a new release of a dependency the project is pinned to>;
- <a report from a user: an issue, a forum post>;
- <a release of the project itself>.

A P1 gets fixed; everything else waits in `docs/known-issues.md`. No new phases, refactors or review rounds are started
unprompted.

## Decisions

| Date | Decision | Why | By |
| --- | --- | --- | --- |
| <date> | <…> | <…> | <user / proposed and accepted> |

## Risks and limits

- <what could invalidate the result, and how it is checked>.

## Open questions

- <question for the user, with the recommended answer>.
