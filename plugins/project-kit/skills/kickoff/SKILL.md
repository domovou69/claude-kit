---
name: kickoff
description: Use when starting a new project or a new repository, or a big pivot inside one that needs a fresh plan — before any code: technology health check, which plugins of the claude-kit marketplace (and, only when the gain is noticeable, third-party ones) to use, the project CLAUDE.md and PLAN.md from templates with empty slots, stage estimates and the first plan PR. Not for the next stage of a project that already has a PLAN.md (follow the plan and its stage prompt), for reviewing a finished project or turning lessons into rules and hooks (project-kit:retro), or for the domain work itself — a converter, device runs, an LLM comparison or a release have their own skills.
---

# Project kickoff

The first hour of a project decides what the next weeks repeat. The rules below came from three projects started
within two weeks of each other (an iOS converter, an Android benchmark, an Android converter). Each new start
re-learned something the previous one already knew: the rules were copied by hand, a technology turned out to be
deprecated after eleven PRs, a plan copied the order that had cost the last project most of its commits.

## The rules

1. **Health check before the plan.** Before PLAN.md and before any key choice of technology, API or tool: is it
   deprecated, or likely to be within the project's horizon? The green / yellow / red verdict with a horizon in years
   is the first section of PLAN.md; on yellow or red, 2–3 alternatives and the user's decision. See
   [health check](references/health-check.md).
2. **PLAN.md before code, with an estimate per stage.** Every stage has wall time and its share of the usage window,
   the plan has a total and a cheaper path, and the user says "yes" before stage 1. The plan is the first PR. Check it
   with `node scripts/kickoff-check.js <project>` (in this skill's folder).
3. **Rules in their layer, never copied.** Personal rules stay in `~/.claude/CLAUDE.md`; the project `CLAUDE.md` holds
   project parameters and rules that hold only here; hooks enforce what must always hold. Do not copy personal rules
   into the project's files, its memory or a start prompt. See [where a rule lives](../../references/rule-layers.md).
4. **Propose the kit's plugins, and third-party ones only for a noticeable gain.** List the kit
   (`node scripts/kit-inventory.js --project <project>`), name the plugins and skills that fit and what each gives
   this project, and which hooks are already on. A third-party plugin or skill is proposed only when the gain is
   noticeable, and it is read in full and shown to the user before it is installed. See [plugins](references/plugins.md).
5. **Review the plan against the previous project.** If a similar project came before, list what cost it most
   (rework rounds, fix PRs, reruns) and how this plan avoids each, before the user approves. Do not copy its stage
   order because it is there.
6. **Decisions go into PLAN.md the turn they are made.** A choice agreed in chat is a dated row under "Decisions";
   a stage prompt for a new window is written after memory and the plan are updated, never only in chat.
7. **A public repository holds no private data.** No device ids (UDID, serial), team or signing ids, bundle ids of
   private apps, tokens, local paths or e-mail addresses in committed files; they go to a git-ignored local file the
   project `CLAUDE.md` points to.

## Workflow

| # | Step | Output |
| --- | --- | --- |
| 0 | Goal and constraints | In the user's words: what the project answers or ships, what comes next on yes / no, deadlines, host and network limits (hotspot, power), budget |
| 1 | Health check | The verdict table for every key technology (rule 1); alternatives on yellow / red; the user decides |
| 2 | Kit inventory | `node scripts/kit-inventory.js --project <dir>`: kit plugins, their skills and hooks, enabled or not, signals found in the project. Propose what fits (rule 4); the user picks |
| 3 | Previous project | What carries over (code, tools, recipes from its memory) and what cost it most (rule 5) |
| 4 | Estimate | "≈N min, ≈X % of the window" for writing the plan itself, then wait for "yes" |
| 5 | PLAN.md | From the domain skill's plan template when one fits (`locator-converter:build`, `llm-benchmark:llm-vs-tool`), otherwise [templates/PLAN.md](templates/PLAN.md): health check first, stages with estimates, total, cheaper path, decisions, lessons |
| 6 | CLAUDE.md | [templates/CLAUDE.md](templates/CLAUDE.md): project parameters and project-only rules, links to the skills in use; nothing from `~/.claude/CLAUDE.md` |
| 7 | Check | `node scripts/kickoff-check.js <dir>`: no FAIL (health check verdict, stage estimates, empty slots, copied personal rules, private data) |
| 8 | Plan PR | Repository created only after the user agrees (public or private is the user's call); the first commit of a new repository may go to `main`, the plan goes in a branch and a PR; the user merges |
| 9 | Memory and handoff | A project memory file (goal, decisions, status, next stage); then the model + effort for stage 1, whether it needs a new window, and its prompt |

## Shapes that come up

- **A sibling of a finished project** (the same tool for another platform): step 3 matters most. Reuse its code and
  tools by name, and write the review table "previous order → problem → now" into the plan.
- **A measurement before a build** (does X pay off?): the plan says what happens on each answer; stage 1 is a
  feasibility spike with a go / no-go note.
- **A pivot inside a running project**: run steps 1–5 for the new part only and add it to the existing PLAN.md as a
  new section; the project `CLAUDE.md` changes only if a parameter changes.

## When you finish

Say what the user has to decide or merge next, the model + effort for stage 1, and whether it needs a new window; if
it does, update memory first, then give the prompt.
