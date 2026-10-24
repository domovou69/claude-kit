# LLM versus <tool>: plan

Fill every slot (`<…>`) before the first run. Changing a slot after a run is a deviation: write it in the
"Deviations" table, never over the old value.

## Question

<One sentence: what decision the comparison informs, for example "do users still need the converter if they have
Claude?">

## Setup

| Slot | Value |
| --- | --- |
| Tool and version | <name, version or commit> |
| Engine that verifies answers | <device / emulator / compiler, versions> |
| Inputs | <N total = N real-world + N edge cases; how sampled> |
| Input file / key file | <input.json (shuffled, no group labels) / key.json (tool answers, hidden from models)> |
| Models | <model ids> |
| Efforts | <one per model, at most xhigh> |
| Conditions | <plain; with rules (optional)> |
| Runs per cell | <1 = indicative; noise about ±3 points on edge cases> |
| Chunk size, timeout | <100 items, 10 min> |
| CLI version | <claude --version> |
| Cost basis | <CLI total_cost_usd, API list prices> |

## Scoring (fixed before the first run)

| Verdict | Weight |
| --- | --- |
| CORRECT | <+1> |
| CLOSE | <+0.5> |
| WRONG | <−1> |
| INVALID | <−1> |
| SKIP | <0, outside the denominator> |
| MISSED | <0> |
| MISSING | <0, own column> |

- Reference: the tool = 100 %. Model wins go to the tool backlog with a triage verdict.
- Denominators: <real-world N_R, edge cases per category and weights>.
- Text match with the tool = agree; every difference is checked on <engine>.

## Steps

| # | Step | Estimate (min / % of window) | Status | Result |
| --- | --- | --- | --- | --- |
| 0 | Plan (this file) | | | |
| 1 | Input and key | | | |
| 2 | Pilot: <model> <effort>, plain | | | |
| 3 | Tool fixes from the pilot (own PR) | | | |
| 4 | Plain wave | | | |
| 5 | Verify differences | | | |
| 6 | Rules wave (optional) | | | |
| 7 | Score, table, tool backlog | | | |
| 8 | Report | | | |

## Results

| Run | Correct | Close | Wrong | Invalid | Skip | Missed | % of tool | min | $ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tool | | | 0 | 0 | | – | 100 | | 0 |

## Deviations

| Date | Slot | Planned | Actual | Why |
| --- | --- | --- | --- | --- |

## Limits

<One run per cell; one task; rules fitted to the errors (no holdout); cost at API list prices; …>
