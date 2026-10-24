# Prompts and rules

## The plain prompt

- A realistic task, as a user would write it: "convert these locators", the format of the input and of the output
  file, nothing about the tool's internals.
- The same text for every model and effort; the runner stores it in every record (`promptText`).
- Ask for a machine-checkable format (a prefix, a JSON field). Count format violations in their own column and strip
  the prefix before scoring, instead of failing the answer.
- Hide group labels and the key: shuffled input, ids that say nothing, the key in a separate file the model never
  sees.

## A rules prompt

A rules prompt is a second condition ("with rules"), not a fix to the first. It is meant to be fitted to the errors,
so there is no train / holdout split; say so in the report.

1. Collect the plain-wave errors by kind (from the verification step).
2. Write one rule per kind, in the target's terms, with the exact form to produce or the case to skip.
3. Check each rule against the tool's own behaviour and the engine. Rules that contradicted each other, a skip rule
   that was too wide (whole numbers treated as range values) and a missing case (`@content-desc=""`) were found only
   after the first rules wave; that wave was rerun and the old results deleted.
4. Run the rules on one model first, then the wave.
5. Keep one rules file, rewritten in place, with the prompt built from it by a script; old versions live in git.

### A rule that is too wide costs more than it saves

A rule "other tests on `@type`: skip" removed every wrong answer of its kind and made the models skip 76 convertible
real-world inputs: the real-world score fell from about 95 to 80. The narrowed rule (only the forms the tool itself
skips) brought the score back to 94–95 with 0, 0 and 4 wrong answers for the three models.

## What rules can and cannot do

- In both comparisons rules removed nearly all WRONG answers (for example 43 → 0, 56 → 0, 58 → 3) and barely moved the
  real-world score, which the plain prompt already got close to the tool.
- No rules prompt took a model above the tool once the tool's real gaps were fixed.
- A cheap model may still misread a rule. Do not rerun a wave for a single misread; report it.

## Analysis by a model

A strong model can classify errors and write the analysis text. It does not grade: grading is the scorer's and the
engine's job.
