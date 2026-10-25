# The plan page

One page per project, the same look in every project. The plan itself (the reasoning) is `PLAN.md`; the live state is
two files in the repository, and the page is built from them:

| File | Holds | Written by |
| --- | --- | --- |
| `docs/plan.json` | Where we are, the Definition of Done with progress, stages and sub-stages with status, estimate, actual and prompt, what is undecided | Claude, at kickoff and at the end of every stage |
| `docs/known-issues.md` | Found bugs and ideas, P1 / P2 / P3 ([template](../templates/known-issues.md)) | Claude, whenever a finding is not fixed on the spot |

## `plan.json`

Template: [templates/plan.json](../templates/plan.json). The generator validates it and lists every problem.

| Field | Meaning |
| --- | --- |
| `schema` | `1` |
| `project`, `repo`, `updated` | Name; `owner/name` (makes `#12` a link to the pull request); date `YYYY-MM-DD` |
| `here` | `stage`: where the project is, one line. `next`: the next step and who does it, one line |
| `dod[]` | `id`, `goal`, `start`, `current`, `target`, optional `ceiling` (the highest value possible), `unit`, `note`. The bar shows the way from `start` to `target`, up or down; at the target the card says to stop adding scope |
| `stages[]` | `id`, `title`, `status` (`done`, `now`, `next`, `parked`), optional `pr` (`#85`, `#15–#31`), `note`, `estimate` and `actual` (`{ minutes, window_pct }`), `prompt`, `children[]` (one level of sub-stages) |
| `undecided[]` | `text`, optional `recommended` |

Rules the validator enforces: at most one top-level stage is `now`; a top-level `now` or `next` stage has a `prompt`
(the text for the new window: what to read first, the check that the previous PR is merged, the task, the conditions);
ids are unique; numbers are numbers; no `<slot>` left from the template. A stage without its own estimate stands for the
sum of its sub-stages. An estimate or actual that was never made is left out, not guessed.

## Building and publishing

1. Update `docs/plan.json` (the status of the stage that ended, `current` in the Definition of Done, `actual`, `here`) and
   `docs/known-issues.md`.
2. `node scripts/plan-page.js <project> --out <scratch>/plan-page.html` (the output is not committed).
3. Publish the file with the Artifact tool, with the same `file_path` on every update so the link stays the same. The
   page is private; the link goes to the user, nobody else.
4. Say the header in one line: where we are, the next step.

The page loads two fonts from Google Fonts (IBM Plex Sans and Mono), has light and dark themes and works at phone
width. Its look is [templates/plan-design.css](../templates/plan-design.css): six core tokens, four status colors,
three priority colors. Change the file in the kit, never in one project, so the pages stay alike. Status is shown by a
shape and a word as well as a color.

## Why a plain page and not the Dashboard type

The Dashboard Artifact type is built around datasets (queries or attached CSV / JSON), forbids numbers written into the
markup and brings its own fonts. A plan page is a list of statuses with copy buttons and a fixed design, so it is a plain
page generated from a template. Check the type again if its description changes.

## Limits

- The page cannot start work: a button copies the stage prompt, and the user pastes it into a new window.
- The kit's other plan page, [the one on GitHub Pages](../../../../publishing/skills/github-pages-playground/references/plan-page.md),
  is a public read-only view of `PLAN.md` for people who follow a project; it does not replace this one.
