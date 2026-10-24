# Scoring against the tool

## Fix it before the first run

Write the verdicts, their weights and the denominators into the plan before any model runs. A change after seeing
numbers is a new scoring version with a name, applied to new results; published tables keep the version they were
computed with.

## Verdicts

| Verdict | Meaning | Example weight |
| --- | --- | --- |
| CORRECT | Same result as the reference on the engine | +1 |
| CLOSE | Converted with a stated difference that the engine confirms | +0.5 |
| WRONG | Plausible answer that selects or does something else | −1 |
| INVALID | The engine rejects the answer | −1 (or its own column) |
| SKIP | No answer where none is possible | 0, outside the denominator |
| MISSED | No answer where the tool has one | 0 |
| MISSING | No entry for this id in the output | 0, own column |

The first comparison gave WRONG 0 credit. Models then tied the tool on the real-world score while writing 4–43 wrong
answers each, which the headline number did not show. WRONG became −1 and a column of its own.

## The tool is 100 %

- Model % = model score / tool score, on the same inputs and the same scorer. A model above 100 % means the tool is
  short there.
- Every input where a model is right and the tool skips or is close goes to a **tool backlog** (a JSON file and a
  report section), with a triage verdict: real gap, or false finding (the model was right only on this screen, the
  verifier excused it, …). False findings are scored by the triage verdict, and the triage map lives in code.
- Fixing real gaps raises the tool's score; models are re-divided by the new tool score in **new** tables only.
- If the tool cannot reach 100 % of something (no exact form exists), show its ceiling as "max reachable" so readers
  do not expect 100.

## Tables

| Run | Correct | Close | Wrong | Invalid | Skip | Missed | % of tool | min | $ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tool | … | … | 0 | 0 | … | – | 100 | < 0.1 | 0 |
| Model A, effort, plain | … | … | … | … | … | … | … | … | … |

- WRONG and INVALID stay visible even at 0.
- Cost and time are separate columns, per run.
- A breakdown of WRONG by kind (case, regex flags, invented syntax, …) under the table.
- Two scores when the inputs have two groups (real-world and edge cases), each with a fixed denominator.

## Noise

One run per cell. Repeats of the same cell moved the edge-case score by about ±3 points, while the real-world score
barely moved. Say so under the table, and do not call smaller differences findings. Repeats cost a full wave each;
run them only when a decision depends on a difference near the noise.

## Never rescore published results

Re-scoring stored runs to reshape one table once cost about 15 % of a usage window. Rescoring is for a new scoring
version applied going forward, not for polishing a published table.
