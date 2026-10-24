# Plan — <project name>

<One or two sentences: what the project answers or ships.>

Started <date>. Related projects: <links, or "none">.

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

## Scope

- In: <…>.
- Out: <…> (why).

## Stages

Times are wall clock; "window" is the share of one 5-hour usage window the stage costs (background runs and downloads
cost little window but take wall time). Each stage needs a "yes" before it starts.

| # | Stage | Output | Wall time | Window | Status |
| --- | --- | --- | --- | --- | --- |
| 0 | <scaffold: repository settings, CI, packaging basics> | <files, checks green> | <≈N min> | <≈X %> | <planned> |
| 1 | <…> | <…> | <≈N min> | <≈X %> | <planned> |
| | Total | | <≈N h over M sessions> | <≈X % of one window> | |

Cheaper path: <which stages to drop or shrink, and what is lost>.

## Decisions

| Date | Decision | Why | By |
| --- | --- | --- | --- |
| <date> | <…> | <…> | <user / proposed and accepted> |

## Risks and limits

- <what could invalidate the result, and how it is checked>.

## Open questions

- <question for the user, with the recommended answer>.
