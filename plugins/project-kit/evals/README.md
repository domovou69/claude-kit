# project-kit evals

Pilot suite for `project-kit:kickoff` (three cases, run with and without the plugin).

| Case | Checks |
| :- | :- |
| `health-check-first` | A project on a technology with an announced end of life: the health check is the first section of `PLAN.md` with a yellow or red verdict, stages carry time and window-share estimates, the plan has a total and a cheaper path, no code files exist |
| `personal-rules-not-copied` | The user's personal rules are in the prompt; none of them is copied into the project `CLAUDE.md` |
| `trigger-no-keyword` | A request that never says "kickoff", "new project" or "plan"; the same plan checks as above, plus an indicator that the skill fired |

All graders are free (`regex`, `file_exists`, `tool_used`); there is no judge model. `Write` has to be granted because
the skill's output is files. `Bash` is not granted, so the skill's scripts do not run in these evals (the
`node --test` suite covers them).

```
cd plugins/project-kit
claude plugin eval . --runs 3 --model claude-sonnet-5-5 --judge-model claude-sonnet-5-5 --no-publish --allow-tools Write
```

Results land in `evals/results/` (git-ignored). Graders for the plan are `llm` rubrics, not kit vocabulary; structural
checks stay `regex` / `file_exists`. The personal-rules prompt lists the rules without saying they are global.

Last measured run (3 runs per arm, Sonnet 5.5, judge Sonnet 5.5): health-check-first 1.00 vs 0.57, personal-rules-not-copied
1.00 vs 0.29, trigger-no-keyword 1.00 vs 0.39; the skill fired in all with-plugin runs.
