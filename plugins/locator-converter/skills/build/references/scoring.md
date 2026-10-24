# Scoring

A score answers "how much of what is achievable does the converter do, and how often is it wrong?" It is only
useful if it means the same thing every time it is computed.

## The hard rules

- **Rule 3: weights and denominators are fixed before the first measurement.** Write them in the plan. If they
  must change, that is a new scoring version with a name (`v1`, `v2`), not an edit.
- **Rule 4: WRONG is a separate headline.** Every table and every summary has a WRONG (and INVALID) column next to
  the score, even when it is 0.
- **Rule 5: published results are never rescored.** Articles, charts, released READMEs and stored tables keep the
  version they were computed with. A new version applies to new results only; keep a switch (`SCORING=v1`) that
  reproduces the published numbers.

## Verdicts

| Verdict | Meaning | Credit (v2) |
| --- | --- | --- |
| CORRECT | converted, oracle `EQUAL` | 1 |
| DRIFT | converted as close, differs exactly as the warning says | 0.5 |
| CORRECT-SKIP | skipped, no exact form exists | outside the denominator |
| GAP | skipped, an exact form exists | 0 |
| WRONG | converted, selects something else, no matching warning | −1 |
| INVALID | converted, the engine rejects the target | −1 |
| MISSING | (comparisons only) no answer for this input | 0 |
| EXCLUDED | not a locator, or not decidable | outside every denominator |

The first version gave WRONG 0; it was changed to −1 because a locator that silently breaks a test is worse than a
skip. That change was made as `v2`, and the published `v1` numbers were left as they were.

## Two scores, fixed denominators

- **R, real-world:** `100 × Σcredit / N_R`, where `N_R` = real locators that have an exact or close form (fixed
  once, from the oracle and the reference, not from what the converter happens to convert).
- **S, edge cases:** per category, `Σcredit / N_category`, then a weighted sum with weights written in the plan.
  Small categories weigh a lot per case; say so next to the table.
- **C, conversion rate:** converted / all real locators in scope. It depends on the data mix, not only on the
  converter.

```js
// Fixed-denominator score. `expressible` comes from the frozen key, never from the converter's output.
const CREDIT = { v1: { CORRECT: 1, DRIFT: 0.5, WRONG: 0, INVALID: 0 },
                 v2: { CORRECT: 1, DRIFT: 0.5, WRONG: -1, INVALID: -1 } };
function score(verdicts, expressible, version = process.env.SCORING ?? 'v2') {
  const credit = CREDIT[version];
  let sum = 0, wrong = 0;
  for (const id of expressible) {
    const v = verdicts[id] ?? 'MISSING';
    sum += credit[v] ?? 0;
    if (v === 'WRONG' || v === 'INVALID') wrong++;
  }
  return { score: +(100 * sum / expressible.length).toFixed(1), wrong, version };
}
```

## The ceiling

The converter rarely reaches 100: close forms earn 0.5 and some locators have no exact target form. State the
ceiling (the best score any converter could reach on these data) and show it on charts. When every expressible
locator is CORRECT or documented DRIFT, say "R = R_max on these data".

## Comparing with something else (an LLM, another tool)

- The converter is the reference: **% of the converter** = other score / converter score, or one combined number
  such as `Q = 100 × (0.4·R/R_conv + 0.6·S/S_conv)`, weights fixed in advance.
- Anything where the other side beats the converter is a converter backlog item; check it on the oracle before
  believing it (several were false findings).
- Cost and time are separate columns, not part of the score.
- WRONG stays a headline here too: a model can match the converter's score and still write dozens of wrong
  locators.

## Keeping it cheap

Re-scoring every stored run to reshape one table once took 15 % of a usage window for nothing the user needed.
Before re-running a scoring pipeline for presentation only, estimate its cost and ask.
