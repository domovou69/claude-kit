# project-kit

Skills for the start and the review of a project, so that what one project learned is in place before the next one
needs it.

| Skill | Use it when | Not for |
| :- | :- | :- |
| `project-kit:kickoff` | Starting a new project or repository, or a pivot that needs a fresh plan: health check, which kit plugins to use, `CLAUDE.md` and `PLAN.md` from templates, stage estimates, the plan PR | The next stage of a project that has a plan, a retro, the domain work itself (a converter, device runs, a comparison, a release) |
| `project-kit:retro` | A project or stage has ended, or every few weeks: feedback memory → missing rules, rules broken again → hook candidates, duplicated rules → one copy, unused skills → new description or removal, delivered as a PR to this kit | Starting a project, a stage's results report, writing down one rule the user just stated |

## What the skills give you

- **kickoff**: seven rules (health check before the plan; PLAN.md before code with an estimate per stage; rules in
  their layer, never copied; propose the kit's plugins, third-party ones only for a noticeable gain; review the plan
  against the previous project; decisions into PLAN.md the turn they are made; no private data in a public
  repository), a 10-step workflow, references ([health check](skills/kickoff/references/health-check.md),
  [plugins](skills/kickoff/references/plugins.md)), templates with empty slots
  ([PLAN.md](skills/kickoff/templates/PLAN.md), [CLAUDE.md](skills/kickoff/templates/CLAUDE.md)) and two scripts:
  - [`kit-inventory.js`](skills/kickoff/scripts/kit-inventory.js): the kit's plugins with their skills and hooks,
    whether each is enabled at user or project scope, and the signals found in the project (an npm package, mobile
    test dependencies, an `llm/` folder, locator code, no `PLAN.md` yet);
  - [`kickoff-check.js`](skills/kickoff/scripts/kickoff-check.js): health check first with a verdict, a stage table
    with estimates, a total, a cheaper path, a decisions section, no template slots left, no personal rules copied
    into the project `CLAUDE.md`, no device ids, tokens, e-mail addresses or local paths.
- **retro**: six rules (every feedback memory ends in one layer; said twice → written, broken again → hook candidate;
  one copy of each rule; unused skills fixed or removed; kit changes as one PR, changes outside it only after "yes";
  anonymized), an 8-step workflow, references ([triage](skills/retro/references/triage.md),
  [the kit PR](skills/retro/references/kit-pr.md)), a [report template](skills/retro/templates/retro-report.md) and
  [`retro-scan.js`](skills/retro/scripts/retro-scan.js): per feedback memory, the best match in the user and project
  `CLAUDE.md`, the kit's hooks and its skills (word overlap per list item or table row, rare words weigh more), the
  number of incidents and a suggestion; rules duplicated or diverged across projects; memory index problems; how often
  each kit skill was invoked (Skill tool calls and slash commands in the transcripts), with whether its plugin is
  enabled.
- Shared: [where a rule lives](references/rule-layers.md): hook, user `CLAUDE.md`, project `CLAUDE.md`, skill,
  `PLAN.md` or memory, and when a rule moves up a layer.

The scripts are Node with no dependencies and only read; run them with `node` from the skill's folder. Their scores
are triage aids for Claude: the skills say to read the best match before acting on it, and the retro report shows the
user conclusions only, no percentages.

## No hook

Starting and reviewing are procedures that need judgement; nothing here must hold on every tool call. The rules that
must always hold, which a retro finds, become hooks in the plugin they belong to (`git-guard`, `mobile-test-runs`,
`llm-benchmark`, `publishing`).

## Test

From the repository root: `node --test` (both kickoff scripts on throwaway kits and projects, the shipped templates,
and the retro scan on a throwaway projects folder). [tests/past-mistakes.md](tests/past-mistakes.md) replays 15 real
mistakes from starting and running three projects; each must map to a skill item, a check or a scan output.

## Install

```
/plugin install project-kit@claude-kit
```

Then ask by task ("start a new project for …", "run a retro on my projects") or call `/project-kit:kickoff`,
`/project-kit:retro`.
