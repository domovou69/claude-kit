---
name: github-pages-playground
description: Use when adding an online playground for a JavaScript library or CLI on GitHub Pages — a static page where people paste input and see the tool's output — built from the library's own modules with no copy and no new dependencies, a parity check against the library in CI, a Pages workflow, and links from the README, the repo and articles; optionally a plan page built from PLAN.md. Not for documentation sites or blogs (Jekyll, Docusaurus), apps that need a server or an API key, or libraries whose core needs the file system or Node APIs and cannot run in a browser.
---

# GitHub Pages playground

A playground lets people try the tool before they install it, and a link to it from npm, the README and an article is
the cheapest demo there is. It is only worth having if it gives **exactly** what the library gives: same code, no copy,
checked on every case. The recipe came from two converter playgrounds built the same way.

## The rules

1. **Same core, no copy.** `site/build.js` reads the library's core modules and wraps them into one browser script
   in `_site/`; nothing from `lib/` is copied into `site/` or committed. Core modules use no `fs`, `process` or
   `Buffer`; the build fails if one does. Modules that need Node (file scanner, CLI) stay out.
2. **A parity check against the library,** on every test case the library has (and with every option the page
   exposes): the bundle and the page's result model must give the same output as `require('..')`. It runs on every
   PR and before each deploy. Name it `site/check.js`, not `test.js`, if the project runs `node --test` without
   arguments.
3. **The npm package does not change.** `package.json` untouched, `site/` and `_site/` not in `files`;
   `npm pack --dry-run` lists the same files before and after (say the count in the PR).
4. **Pages from Actions, after the merge.** The workflow builds on push to `main`, so the page goes live only after the
   merge. Pages source must be "GitHub Actions"; enabling it (`gh api -X POST repos/OWNER/REPO/pages -f
   build_type=workflow`) is a repo setting the user approves; the plugin's hook asks.
5. **Link it where people look.** Next to the run commands at the top of the README (not at the bottom), the repo
   "About" website, the article's intro. A link at the end of the library section was not found.
6. **A static, safe page.** No network calls, no analytics, no build tools; output written with `textContent`, never
   `innerHTML`; light and dark theme; no horizontal scroll at 360 px.

## Workflow

| # | Step | Output |
| --- | --- | --- |
| 0 | Check the core | List the modules the conversion needs; grep them for `fs`, `path`, `process`, `Buffer`, `child_process`. If the core needs Node, stop: the playground needs a refactor first, which is a separate decision |
| 1 | Build script | [templates/build.js](templates/build.js) → `site/build.js`: fill `CORE`, `MODULES`, `GLOBAL`, `EXPORTS` |
| 2 | Page | [templates/index.html](templates/index.html) and [templates/playground.js](templates/playground.js): pure `convertLines` + DOM part; one example per outcome (exact / close / skip, or what the tool has); options the library has as checkboxes (off = the library's default) |
| 3 | Parity check | [templates/site-check.js](templates/site-check.js) → `site/check.js`: all cases, all exposed options, the page examples give their labels; added to the test workflow |
| 4 | Workflow | [templates/pages.yml](templates/pages.yml) → `.github/workflows/pages.yml` (check → build → upload → deploy) |
| 5 | Package check | `npm pack --dry-run` file count unchanged; `.gitignore` has `_site/` |
| 6 | PR | One line in the README next to the run commands; the PR says the page goes live after the merge and that Pages must be enabled |
| 7 | After the merge | Pages enabled with the user's OK, the deploy run green, the page opened once on a phone width, the repo "About" website set (asked) |

Details: [recipe](references/recipe.md). A plan page built from `PLAN.md`: [plan page](references/plan-page.md).

## When you finish a step

Say whether the page is live yet (only after the merge and the first deploy) and what the user has to approve
(enabling Pages, the repo website field).
