# Replay test: past mistakes

Seven real mistakes from two LLM-versus-converter comparisons
([xpath-to-class-chain](https://github.com/domovou69/xpath-to-class-chain), "CC";
[xpath-to-uiselector](https://github.com/domovou69/xpath-to-uiselector), "US").
The test: a comparison that follows this plugin must not repeat any of them. Every row names the hook rule or skill
item that catches it. When the plugin changes, replay this table; a row with no matching item is a regression. The
hook and runner rows are also covered by `tests/guard.test.js` and `tests/run-template.test.js`.

| # | Mistake | Cost | Source | Caught by |
| --- | --- | --- | --- | --- |
| L01 | **Opus at `max` burned the window.** First run cut off by the session limit at 460 of 678 answers (38.7 min, $7.57); the retry on the rest ran 42 min, $5.41, all thinking, and wrote nothing. `max` spent 80–90 % of output on thinking for at most +1.6 edge-case points in the other cells | 81 min, $12.98, almost a whole 5-hour window, no result | CC #14, #36 and project notes | **Hook**: `--effort max`, a runner called with `<model> max`, and Agent effort `max` are denied; [SKILL.md](../skills/llm-vs-tool/SKILL.md) rule 7; [cost and time](../skills/llm-vs-tool/references/cost-and-time.md) "The usage window" |
| L02 | **Whole-file runs without chunks.** Sonnet 4.6 wrote nothing for the 678-item file in 20 minutes; an older Haiku answered 100 of 678 in one run and nothing in another | Stopped runs with no output and no cost record | CC #35, #36 and project notes | [SKILL.md](../skills/llm-vs-tool/SKILL.md) rule 5; [templates/run.js](../skills/llm-vs-tool/templates/run.js) (chunks, resume, stream-json usage); [cost and time](../skills/llm-vs-tool/references/cost-and-time.md) "Chunks" |
| L03 | **`--bare` without an API key.** The isolation plan used `--bare`, which accepts only `ANTHROPIC_API_KEY` and ignores the subscription login | Plan reworked before the first run; a deviation in the report | CC #14 and project notes | **Hook**: `claude --bare` denied without `ANTHROPIC_API_KEY`, with the replacement flags; [isolation](../skills/llm-vs-tool/references/isolation.md) "`--bare` is not isolation with a login" |
| L04 | **Run-to-run noise read as a finding.** Prompt v3 and v4 differed in cases the new rule does not touch; the edge-case score moved by about ±3 between two runs of the same cell | Differences below the noise nearly reported as prompt effects | CC #30, #36 | [SKILL.md](../skills/llm-vs-tool/SKILL.md) "Choosing the grid"; [scoring](../skills/llm-vs-tool/references/scoring.md) "Noise" |
| L05 | **Haiku cost basis.** A Haiku run came out at $0.12 for 680 inputs, far below Sonnet's $0.95; it had to be checked against list prices and the request-size rate before it could be published | A number that could have been wrong in a public table | US #19 and project notes | [cost and time](../skills/llm-vs-tool/references/cost-and-time.md) "Where the numbers come from", "Check numbers that look wrong" |
| L06 | **WRONG hidden in the score.** Scoring v1 gave WRONG 0 credit, so models tied the converter on the real-world score while writing 4–43 wrong answers each | The headline did not show the main risk; scoring v2 needed | CC #14 | [SKILL.md](../skills/llm-vs-tool/SKILL.md) rule 4; [scoring](../skills/llm-vs-tool/references/scoring.md) "Verdicts", "Tables" |
| L07 | **Models "ahead" of the tool.** Plain runs found exact answers for all 24 converter gaps between them, and rules runs scored 100.6 % of the Android converter. These were tool shortfalls, not model wins | Fixed only after the comparison (Android converter: 8 gaps, rules runs then 97–98.7 %) | CC #14; US #21, #22 | [SKILL.md](../skills/llm-vs-tool/SKILL.md) rule 3 and workflow steps 2–3 (pilot finds tool bugs first); [scoring](../skills/llm-vs-tool/references/scoring.md) "The tool is 100 %" |

Checked on 2026-10-25: 7 of 7 rows map to a hook rule or a skill item.
