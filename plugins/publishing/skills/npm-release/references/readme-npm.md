# README as the npm page

`README.md` ships in the package and npmjs.com renders it as the package page. The GitHub page shows the same file,
but npm readers want three things fast: what it does, how to run it, whether to trust it.

## What stays in the README

In this order, about 60–100 lines:

1. Name, npm badge, one sentence: what goes in, what comes out.
2. **Try it**: the `npx` command (preview first, then the one that writes), a link to the online playground if there
   is one, right next to the commands.
3. One short example (a diff or an input → output pair) taken from the tool's real output.
4. Key results in three to five lines (for example: wrong results 0, coverage, speed), each linking to the full
   table in `docs/`.
5. The versions it was checked with, and a note that older ones were not.
6. The library call in a few lines.
7. **Documentation**: a list of links (`docs/reference.md`, `docs/results.md`, `docs/how-it-works.md`, articles).
8. License.

## What moves to `docs/`

Full result tables and per-source breakdowns, LLM comparisons, articles and their index, every flag and option,
the JSON report format, device findings, the Claude Code skill, the file layout, history. Link it, do not copy it.

## Why

One package started with a 467-line README (every flag, the optimizer, the JSON report, the device results, the LLM
table). On npm it was a wall of text. The fix moved it to `docs/reference.md` and `docs/results.md` unchanged and cut
the README to 86 lines, later 77. The npm page showed the short version only after the next publish, which needed a
version of its own (see [the npm page](npm-page.md)).

## Keeping it short

- When a release or a phase adds results, update `docs/` first; touch the README only if one of its headline numbers
  changes.
- A one-line change near the top (a playground link next to the run commands) is worth more than a section at the
  bottom: a link at the end of the library section was not found by anyone.
- Write the rule into the project's `CLAUDE.md` ([templates/project-rules.md](../templates/project-rules.md)), so
  every session keeps it.
- A starting point: [templates/README.md](../templates/README.md).
