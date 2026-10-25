# publishing evals

Three cases for `publishing:npm-release` on fictional packages: `readme-trim-and-metadata`, `bump-and-handoff`, `bin-shebang`. Each case builds its fixture with `setup.sh` (hence `--scaffold`; the scripts only write files into the empty workspace).

```
cd plugins/publishing
claude plugin eval . --runs 3 --model claude-sonnet-5-5 --judge-model claude-sonnet-5-5 --no-publish --allow-tools Write Edit --scaffold
```

Last measured run (3 runs per arm): bump-and-handoff 1.00 vs 0.87, readme-trim-and-metadata 0.78 vs 0.56, bin-shebang 0.78 vs 0.78. Before the fixes now in the files: the skill did not fire on `bin-shebang` (the prompt did not mention a release) and `readme-trim` could not pass the metadata grader (no repository URL in the prompt). The fixed prompts were not re-measured.

Results land in `evals/results/` (git-ignored). `Bash` is not granted, so hooks and skill scripts are not exercised here.
