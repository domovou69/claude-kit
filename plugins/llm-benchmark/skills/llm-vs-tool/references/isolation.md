# Isolation

A comparison is fair only if no model sees anything the others do not: no project files, no memory, no hooks, no
tools beyond the task, no earlier answers.

## The run

[templates/run.js](../templates/run.js) does all of this; the list is what to keep if you write your own.

| What | How (Claude Code CLI) | Why |
| --- | --- | --- |
| Empty folder outside the repository | `fs.mkdtempSync(path.join(os.tmpdir(), 'llm-run-'))`, a neutral name, only `input.json` in it | No `CLAUDE.md`, no repo files, no hints in the folder name |
| One task in one call | `claude -p "<prompt>"` | Same entry point for every model |
| Tools | `--tools Read,Write` | No web, no shell, no subagents |
| No settings, hooks, plugins | `--setting-sources ""` | User and project settings, hooks and plugins stay out |
| No MCP servers | `--strict-mcp-config --mcp-config '{"mcpServers":{}}'` | |
| No saved session | `--no-session-persistence` | Nothing to resume from, nothing left behind |
| No prompts for permission | `--permission-mode acceptEdits` | The run must not wait for a person |
| Minimal environment | pass only `HOME USER LOGNAME PATH SHELL TMPDIR LANG` | The parent session's variables stay out |
| Machine-readable result | `--output-format stream-json --verbose` (or `json`) | Cost, tokens and time come from the CLI, per run |
| A timeout per call | kill after N minutes; the chunk is saved as failed | A stuck model does not hold the wave |
| Record the conditions | CLI version, model id, effort, full prompt text, start time, exit code, files written | The run explains itself later |

## `--bare` is not isolation with a login

`--bare` skips settings, hooks and plugins, but it also accepts only `ANTHROPIC_API_KEY` and ignores the
subscription login, so a run under a subscription fails at once. Use the flags above instead and write the
deviation into the report ("`--bare` dropped, it needs an API key; isolation otherwise the same"). The plugin's hook
blocks `claude --bare` when no key is set.

## The binary

The `claude` CLI may not be on `PATH` (for example when Claude Code runs inside an editor extension). Point the runner
at the binary with `CLAUDE_BIN`; the editor extension ships one under its install folder
(`…/anthropic.claude-code-<version>/resources/native-binary/claude`). Record `claude --version` in every run.

## Output

- The prompt names one output file (`output.json`, an array of `{ id, … }`). Some models split large results into
  parts; either allow `output-N.json` and merge, or keep chunks small enough that they do not.
- A missing or broken output file is a failed chunk, never an empty answer set.
- Missing ids are counted (MISSING), not silently dropped.
- Models may use other means than asked (one older model wrote and ran its own script each time); limiting tools to
  Read and Write keeps the condition the same for all.

## Same conditions in the report

State in the report: the CLI version, the tools, the isolation flags, the prompt (quoted), whether runs ran in
parallel, and the host's state if timings are compared.
