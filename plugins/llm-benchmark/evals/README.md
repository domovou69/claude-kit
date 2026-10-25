# llm-benchmark evals

Three cases for `llm-benchmark:llm-vs-tool`: `plan-comparison` (method rules in the plan), `runner-script` (chunks, resume, isolation, cost from the CLI, no effort max, no `--bare`), `effort-max-request` (the user asks for effort max).

```
cd plugins/llm-benchmark
claude plugin eval . --runs 3 --model claude-sonnet-5-5 --judge-model claude-sonnet-5-5 --no-publish --allow-tools Write
```

Last measured run (3 runs per arm): plan-comparison 0.89 vs 0.22 (the `chunks-and-resume` judge was noisy on a long plan and is now a regex), runner-script 0.95 vs 0.71 (the `no-effort-max` regex hit a `// never max` comment and now skips comment lines), effort-max-request 0.92 vs 0.50. The two fixed graders were not re-measured.

Results land in `evals/results/` (git-ignored). `Bash` is not granted, so hooks and skill scripts are not exercised here.
