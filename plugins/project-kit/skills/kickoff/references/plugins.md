# Proposing plugins

The kit exists so that a lesson learned in one project is loaded in the next one without anyone remembering it.
That only works if the plugin is on when the work starts.

## The kit's own plugins

1. Run `node scripts/kit-inventory.js --project <dir>` (in the kickoff skill's folder). It reads the installed
   marketplace (default `~/.claude/plugins/marketplaces/claude-kit`, or `--kit <dir>` for a clone), lists every plugin
   with its skills (name and when to use it) and hooks, says whether it is enabled in the user or project settings,
   and prints the signals it found in the project (an npm package, mobile test dependencies, an LLM folder, locator
   code, …).
2. Signals are hints. Match the plugins against the project's goal from kickoff step 0: a benchmark that will be
   published needs `publishing` later even if there is no `package.json` yet.
3. For each plugin that fits, say in one line what it gives this project ("its hook denies timed runs on battery; the
   `android-emulator` skill has the headless start and the monitor"), and whether to enable it at user scope (all
   projects) or project scope (`--scope project`, committed in `.claude/settings.json`).
4. Hook plugins that guard every project (`git-guard`) are expected at user scope; if one is off, say so.
5. The user picks. Record the chosen plugins and skills in PLAN.md ("Kit plugins") and in the project `CLAUDE.md`
   ("Skills in use") so stage prompts can name them.

Hooks load at session start: after enabling a plugin, the next window has it, the current one may not.

## Third-party plugins and skills

Propose one only when the gain is noticeable: it does something the kit and Claude Code do not, for a task this
project will do more than once. "Nice to have" is not noticeable.

Before installing:

- Read it in full: the manifest, every `SKILL.md`, every hook and script it runs, and what it sends where.
- Show the user what it does in a few lines: what loads when, which hooks run on which tool calls, network access,
  files it writes.
- Install only after the user's "yes", at the narrowest scope that works.

If a third-party plugin keeps proving useful across projects, the retro may propose wrapping the lesson into the kit
instead.

## When the kit has nothing for the task

Say so, and note the task in PLAN.md. If the same kind of task comes up in a second project, the retro proposes a
new skill.
