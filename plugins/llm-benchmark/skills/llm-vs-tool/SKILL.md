---
name: llm-vs-tool
description: Use when comparing LLMs (Claude models, effort levels, with or without a rules prompt) against a deterministic tool on the same task — for example a locator converter, a linter or a code transformer — planning the comparison, running the models in isolation with chunks and --resume, scoring against the tool, verifying differences, and reporting cost and time. Not for building or fixing the tool itself (locator-converter:build for converters), not for device timing benchmarks (mobile-test-runs), and not for general model evaluations with no reference tool.
---

# LLM versus tool

The question is "do you still need the tool if you have an LLM?" The answer is only worth something if every model
got the same task under the same conditions, the tool is the yardstick, and the reader can see how often each side
is **wrong**, what it cost and how long it took.

The method came from two comparisons (Claude models versus an XPath → iOS class chain converter, and versus an
XPath → Android `UiSelector` converter, about 680 inputs each).

## The rules

1. **Isolation.** Every run starts in a new empty folder outside the repository with only the input file, tools
   limited to reading and writing files, no settings, hooks, MCP servers, saved session or parent environment. See
   [isolation](references/isolation.md). `--bare` is not the way to get there: it ignores the subscription login.
2. **One prompt.** The same prompt text for every model and effort, stored in each run record. A rules prompt is a
   second, named condition, never a silent edit.
3. **The tool is 100 %.** Model score = model score / tool score on the same inputs. Where a model beats the tool,
   that is a tool shortfall: it goes to the tool's backlog, gets triaged, and the goal is no model above 100 %. See
   [scoring](references/scoring.md).
4. **WRONG on its own line.** Every table has a WRONG (plausible but selects or does something else) column, and
   INVALID (rejected by the engine) next to it, never only folded into a score.
5. **Chunks and `--resume`.** A long input is split into chunks of 50–100 items; each chunk is an isolated run and
   saved on its own; a finished chunk is never run again. One-request runs over the whole file stopped with nothing
   written. See [cost and time](references/cost-and-time.md) and [templates/run.js](templates/run.js).
6. **Cost and time in separate columns,** per run, from the CLI's own result (`total_cost_usd`, tokens, minutes).
   Never a combined "efficiency" number only.
7. **Effort at most `xhigh`.** `max` spent 80–90 % of its output on thinking for no better result, and one Opus run
   at `max` used up a 5-hour usage window without finishing. The plugin's hook blocks `--effort max`.

## Workflow

Copy [templates/PLAN.md](templates/PLAN.md) and fill its slots first. Then:

| # | Step | Output |
| --- | --- | --- |
| 0 | Plan | Models, efforts, conditions (plain / rules), sample, scoring weights and verdicts fixed before any run; cost estimate per wave |
| 1 | Input and key | One shuffled input file with group labels hidden; the tool's answers in a separate key file |
| 2 | Pilot | One model (a mid-price model at medium effort) versus the tool; every difference checked. Purpose: find tool bugs before the waves |
| 3 | Fix the tool | Tool bugs from the pilot fixed in their own PR; the key refreshed (only the tool's answers change) |
| 4 | Plain wave | Every model at the chosen effort, plain prompt, one run each |
| 5 | Verify | Text match with the tool = agree; every difference checked on the real engine (device, emulator, compiler) |
| 6 | Rules wave (optional) | A rules prompt fitted to the plain-wave errors; check the rules on one run before the whole wave |
| 7 | Score and table | Tool = 100 %; WRONG, INVALID, missed, cost, time as columns; tool backlog from model wins |
| 8 | Report | Method, prompt quoted, table, error kinds, limits (one run per cell, noise), deviations from the plan |

## Choosing the grid

- Start narrow. In both comparisons higher effort did not pay: Opus was flat from `low`, Sonnet from `medium`, Haiku
  got worse above `medium`. A pilot at `medium` and one effort per model for the waves is usually enough.
- One run per cell is indicative, not rigorous. Between two runs of the same cell the edge-case score moved by about
  ±3 points; do not report smaller differences as findings. Repeats are a separate, priced decision.
- Estimate each wave (minutes and share of the usage window) before starting it; a full grid once hit about 80 % of a
  5-hour window during the first stage.

## Verifying differences

- Text agreement with the tool's answer counts as agree without a device check.
- Every difference goes to the real engine. The verifier's own excuses (known engine limits, leftover UI state) are
  code with tests: a verifier that misread a leftover toast made one locator flaky between runs.
- A model answer the engine rejects is INVALID; one that runs but selects something else is WRONG.
- Errors are classified by kind (case-insensitive method, missing regex flag, invented syntax, …): the kinds, not the
  counts, make the report useful and become the rules prompt.

## Rules prompts

See [prompts and rules](references/prompts-and-rules.md): rules are fitted to observed errors, each rule is checked
against the tool's behaviour, and a rule that is too wide costs more than it saves (one "skip on …" rule dropped a
real-world score from about 95 to 80).

## When you finish a step

Update the plan's step table, record cost and time of each run, and say what the next step needs (window share,
device, network).
