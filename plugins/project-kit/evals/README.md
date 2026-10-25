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
claude plugin eval . --runs 1 --model claude-sonnet-5-5 --max-cost-usd 8 --no-publish --allow-tools Write
```

Results land in `evals/results/` (git-ignored). One run per arm is noisy: the same case scored 0.86 and 1.00 with the
plugin in two runs. Use `--runs 3` before drawing a conclusion about a single case.

Known limits: `verdict` and `cheaper path` graders match the kit's own vocabulary (green / yellow / red, "cheaper
path"), so part of the delta is wording rather than behaviour. The `personal-rules-not-copied` prompt states that the
rules are already global, which a model without the plugin also respects, so that case does not separate the arms yet.
