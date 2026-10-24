# Where a rule lives

Both skills sort rules into layers. A rule kept in the wrong layer is either not loaded when it matters (a rule in
one project's memory, invisible in the next project) or loaded everywhere when it is not needed.

| Layer | Holds | Loaded | Example |
| --- | --- | --- | --- |
| Hook (a plugin in this kit) | A rule that must always hold and can be seen in a tool call: the command, the file path, the agent parameters | Runs on every matching tool call; Claude cannot skip it | No commit on `main`; no timed run on battery; no `npm publish` by Claude; no effort `max` |
| `~/.claude/CLAUDE.md` | Personal rules for every project: how the user works with Claude | Every session, every project | Estimate first and wait for "yes"; a branch and a PR for every change; English in files, the user's language in chat; effort at most `xhigh`; the end-of-stage handoff |
| Project `CLAUDE.md` | Project parameters and rules that hold only in this project | Every session in this project | The README is the npm page; release steps; pinned versions; ports; where local-only ids are kept |
| Skill (a plugin in this kit) | A procedure for one kind of task, with its traps | When the task matches the description, or by `/plugin:skill` | Releasing an npm package; a device run; an LLM comparison |
| `PLAN.md` | What the project does, stages with estimates, decisions, status | When a stage starts (the stage prompt says to read it) | Health check verdict; stage table; "Decisions" with dates |
| Memory | State and facts: where things are, what was decided and why, what happened | Index every session, files on demand | Status of each stage; why a version is pinned; a workaround that worked |

## Deciding the layer

1. **Must it hold every time, and does a tool call show a violation?** Both yes → hook. Only one → not a hook: a rule
   that needs judgement ("keep the README short") is a skill item or a `CLAUDE.md` line; a rule the tool call cannot
   show ("say the estimate first") is a `CLAUDE.md` line.
2. **Does it hold in every project?** Yes → `~/.claude/CLAUDE.md`. Only here → the project's `CLAUDE.md`.
3. **Is it a step of a procedure** (do X before Y when doing Z)? → the skill for Z. A new procedure seen in two
   projects → a new skill.
4. **Is it a fact about the current state?** → memory or `PLAN.md`, not a rule.

A rule is written in exactly one layer. Other layers link to it ("see the npm-release skill") instead of copying it;
copies drift (one copy gets an exception, the other does not) and then contradict each other.

## When a rule moves up a layer

- **Said twice → written.** A correction the user makes a second time goes into the right `CLAUDE.md` the same day,
  not only into memory.
- **Written and broken again → hook candidate.** If it passes the test in step 1, write the hook; if it does not,
  make the written rule more precise (what exactly to check, in which command) and say which step missed it.
- **The same rule in two projects' memory → `~/.claude/CLAUDE.md` or a skill**, and the memory files shrink to a
  pointer or are deleted.

## What makes a good hook

- It parses the tool input (the shell command, the file path), so a commit message that mentions the forbidden
  command is not a violation. The kit's plugins each carry a copy of the shell parser.
- Deny with a message that says what to do instead; ask (not deny) when the user may want it now and then.
- A bypass for the user only where a real case needs one (an environment variable in front of the command that turns
  the deny into an ask).
- On an internal error it lets the command through and says so on stderr: a broken hook must not block work.
- Tests with `node --test` for every rule and every bypass, and a row in the plugin's `tests/past-mistakes.md`.
