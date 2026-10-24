# llm-benchmark

Skills and a hook for comparing LLMs with a deterministic tool, fairly and within a usage budget.

| Skill | Use it when | Not for |
| :- | :- | :- |
| `llm-benchmark:llm-vs-tool` | Comparing Claude models (efforts, plain or with rules) against a tool on the same task: plan, isolated chunked runs, verification, scoring against the tool, cost and time | Building or fixing the tool, device timing benchmarks, model evaluations with no reference tool |

## What `llm-vs-tool` gives you

- Seven rules: isolation; one prompt; the tool is 100 %; WRONG on its own line; chunks and `--resume`; cost and time
  in separate columns; effort at most `xhigh`.
- A workflow: plan → input and key → pilot → tool fixes → plain wave → verify → rules wave → score → report.
- References: [isolation](skills/llm-vs-tool/references/isolation.md), [scoring](skills/llm-vs-tool/references/scoring.md),
  [cost, time and chunks](skills/llm-vs-tool/references/cost-and-time.md),
  [prompts and rules](skills/llm-vs-tool/references/prompts-and-rules.md).
- Templates: [PLAN.md](skills/llm-vs-tool/templates/PLAN.md) with empty slots, and [run.js](skills/llm-vs-tool/templates/run.js),
  an isolated, chunked, resumable runner for the `claude` CLI (Node, no dependencies; `CLAUDE_BIN` points at the
  binary when it is not on `PATH`).

## Hook

`scripts/guard.js` (`PreToolUse` on Bash and Agent, Node, no dependencies):

| Rule | Effect |
| :- | :- |
| `--effort max` / `--effort=max`, a runner called as `<model> max`, or an Agent call with effort `max` | Denied. With `LLM_BENCH_ALLOW_MAX=1` in front of a Bash command the user is asked instead |
| `claude --bare` with no `ANTHROPIC_API_KEY` | Denied, with the isolation flags to use instead |

Quoted text and heredocs are not treated as commands. On an internal error the hook lets the command through.

## Test

From the repository root: `node --test` (hook cases, and the runner template against a fake `claude`).
[tests/past-mistakes.md](tests/past-mistakes.md) replays seven real mistakes from two comparisons; each must map to a
hook rule or a skill item.

## Install

```
/plugin install llm-benchmark@claude-kit
```

Then ask by task ("compare Opus and Sonnet with the converter") or call `/llm-benchmark:llm-vs-tool`.
