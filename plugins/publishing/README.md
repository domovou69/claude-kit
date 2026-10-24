# publishing

Skills and a hook for putting a tool in front of people: the npm release, the dev.to article, the online playground.

| Skill | Use it when | Not for |
| :- | :- | :- |
| `publishing:npm-release` | Preparing or making an npm release: README as the npm page, metadata and search, badge, `bin`, bump PR, tag, GitHub release, the check after publishing, an upstream watch | The article, the playground, private registries, monorepo release tooling |
| `publishing:devto-article` | Writing, formatting or updating a dev.to article about your tool: repo copy, front matter, tables, PNG charts, cover, numbers and commands checked, link back after publishing | The release itself, the playground, social posts (only the last step) |
| `publishing:github-pages-playground` | Adding a GitHub Pages playground built from the library's own modules, with a parity check in CI and a Pages workflow; optionally a plan page from `PLAN.md` | Docs sites and blogs, apps that need a server or an API key, cores that need Node APIs |

## What the skills give you

- **npm-release**: seven rules (the user runs `npm publish`; README is the npm page; the npm page changes only with a
  publish; a release is its own PR from fresh `main`; `bin` is `100755`; tag and GitHub release on the day of the
  publish; check what was published), a 10-step workflow, references
  ([README as the npm page](skills/npm-release/references/readme-npm.md), [the npm page](skills/npm-release/references/npm-page.md),
  [release steps](skills/npm-release/references/release-steps.md), [upstream watch](skills/npm-release/references/upstream-watch.md)),
  templates (npm-page [README](skills/npm-release/templates/README.md), [release PR](skills/npm-release/templates/release-pr.md),
  [project rules](skills/npm-release/templates/project-rules.md) for `CLAUDE.md`) and
  [`scripts/release-check.js`](skills/npm-release/scripts/release-check.js): README length and badge, metadata, `bin`
  mode in git and shebang, version against npm, tag, branch against `origin/main`, `npm pack` file list.
- **devto-article**: six rules (repo copy is the source; every number from a data file; nothing unreleased; dev.to
  format; link back the same day from fresh `main`; the user publishes and owns claims about themselves), an 11-step
  workflow, references ([dev.to format](skills/devto-article/references/devto-format.md),
  [charts and cover](skills/devto-article/references/charts-and-cover.md),
  [after publishing](skills/devto-article/references/after-publishing.md), [style](skills/devto-article/references/style.md)),
  templates ([article](skills/devto-article/templates/article.md), [render.sh](skills/devto-article/templates/render.sh)
  for 2× PNGs through headless Chrome, [cover.svg](skills/devto-article/templates/cover.svg) 1000×420) and
  [`scripts/article-check.js`](skills/devto-article/scripts/article-check.js): front matter and tags, SVG and relative
  images, wide tables, `<br>`, a number split from its unit, prose in table cells, placeholders and local paths, and
  flags the published README does not mention yet.
- **github-pages-playground**: six rules (same core, no copy; parity check; npm package unchanged; Pages from Actions
  after the merge; link it where people look; static and safe), an 8-step workflow, references
  ([recipe](skills/github-pages-playground/references/recipe.md), [plan page](skills/github-pages-playground/references/plan-page.md))
  and templates ([build.js](skills/github-pages-playground/templates/build.js) that refuses Node-only modules,
  [site-check.js](skills/github-pages-playground/templates/site-check.js), [playground.js](skills/github-pages-playground/templates/playground.js),
  [index.html](skills/github-pages-playground/templates/index.html), [pages.yml](skills/github-pages-playground/templates/pages.yml)).

The scripts are Node with no dependencies; run them with `node` from the skill's folder.

## Hook

`scripts/guard.js` (`PreToolUse` on Bash, Node, no dependencies). It parses the shell command (quotes, `&&`, pipes,
heredocs, `bash -c`), so a commit message or PR body that mentions `npm publish` is not a publish.

| Rule | Effect |
| :- | :- |
| `npm` / `pnpm` / `yarn` / `bun` `publish`, `unpublish`, `deprecate`, `access`, `dist-tag add/rm`, `owner add/rm`; `np`, `release-it`, `semantic-release`, `lerna publish`, `changeset publish` (also through `npx` / `dlx` / `npm exec`) | Denied: the user runs registry writes. `--dry-run` passes |
| `gh release create/edit/delete/upload`, `git push` of a tag (`--tags`, `--follow-tags`, `vX.Y.Z`, `refs/tags/…`) | The user is asked |
| `gh repo edit`, `gh api` writes to `…/pages` | The user is asked |
| `curl` / `wget` / `http` writes to `dev.to/api/` | The user is asked |

On an internal error the hook lets the command through and says so on stderr.

## Test

From the repository root: `node --test` (hook cases, both check scripts, and the playground templates on a throwaway
library). [tests/past-mistakes.md](tests/past-mistakes.md) replays 15 real publishing mistakes from two packages; each
must map to a hook rule, a check or a skill item.

## Install

```
/plugin install publishing@claude-kit
```

Then ask by task ("prepare the 1.3.0 release", "write the dev.to article", "add an online playground") or call
`/publishing:npm-release`, `/publishing:devto-article`, `/publishing:github-pages-playground`.
