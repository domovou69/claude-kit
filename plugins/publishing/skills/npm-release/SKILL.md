---
name: npm-release
description: Use when preparing or making an npm release of a package — the first publish or a new version — including the README that becomes the npm page, package metadata and search keywords, the npm badge, the bin entry point, the version bump PR, the release tag, the GitHub release, the check after publishing and an upstream-watch workflow for what the package depends on. Not for writing an article about the package (publishing:devto-article), building a browser playground for it (publishing:github-pages-playground), or private registries and monorepo release tooling (changesets, lerna), which are not covered.
---

# npm release

A release is small, but every slip in it is public and most cannot be fixed without another version: the npm page
shows the README, badge and metadata of the last publish, a published version cannot be reused, and a tag or a
GitHub release points at whatever commit it was made on. The steps below came from seven releases of two CLI
packages (1.0.0–1.0.3 and 1.0.0–1.2.0).

## The rules

1. **The user runs `npm publish`.** Claude prepares everything, runs the checks and says the exact command; the user
   publishes (and logs in) in their own terminal. The plugin's hook denies `npm publish`, `unpublish`, `deprecate`,
   `dist-tag add/rm` and release tools that publish; `--dry-run` passes.
2. **The README is the npm page.** It ships in the package and is what npmjs.com shows, so it stays short: what the
   tool does, how to run it, one example, a few headline results, the versions checked, the library call, links to
   `docs/`, the license. Everything else goes to `docs/` and is linked. See [README as the npm page](references/readme-npm.md).
3. **The npm page changes only with a publish.** A new README, badge, description, keywords or homepage reaches
   npmjs.com only with the next version. Put such changes in before the release, or make a docs-only patch release
   on purpose and say so in its PR. See [the npm page](references/npm-page.md).
4. **A release is its own PR from a fresh `main`.** It bumps `version` in `package.json` and lists the changes since
   the last version in its description (no CHANGELOG file unless the project has one). Base `main`, never another
   PR's branch: a PR merged into a base branch that was already merged never reaches `main`. After the merge, check
   that `main` has the new version before anything is tagged or published.
5. **Every `bin` file is executable in git** (`100755`) and starts with `#!/usr/bin/env node`. npm sets the bit on
   install, so npm users do not notice; `npx` from a clone fails with "Permission denied" after the next pull.
6. **Tag and GitHub release on the day of the publish.** An annotated tag `vX.Y.Z` on the merge commit, a GitHub
   release from that tag with the PR's change list, both right after the user publishes. The hook asks before
   `gh release create` and before a tag is pushed.
7. **Check what was published,** not what was built: `npx <name>@<version> --version` (and one real command) in a
   new empty folder, `npm view <name> version`, the npm page once.

## Workflow

| # | Step | Output |
| --- | --- | --- |
| 0 | First release only: prepare the package | Name free on npm (`npm view <name>` → 404), `private` removed, `files` list, `bin` + shebang, `description` that starts with what people search for, 10–15 `keywords`, `repository`, `homepage`, `license`, the npm badge already in the README. See [the npm page](references/npm-page.md) |
| 1 | Release review | Every number, version, name and link in README, `docs/`, the skill files and `package.json` checked against its source (test output, generated reports, `npm pack --dry-run`); fixes in their own PR |
| 2 | Bump PR | Branch `release/X.Y.Z` from fresh `origin/main`; only the version (and README numbers if a headline changed); description from [templates/release-pr.md](templates/release-pr.md) |
| 3 | Pre-release check | `node scripts/release-check.js` (in this skill's folder) on the package: no FAIL. It checks the README, badge, bin modes, metadata, version against npm, tag, branch and the `npm pack` file list |
| 4 | Merge (user) | `main` has the new version (`git show origin/main:package.json`); run the check again on `main` |
| 5 | Tag | `git tag -a vX.Y.Z -m vX.Y.Z <merge commit>`; push it with the user's OK |
| 6 | Publish (user) | Claude gives the exact command (`npm publish`, plus `--access public` for a first scoped package); the user runs it |
| 7 | Verify | `npx <name>@X.Y.Z --version` in a new empty folder, `npm view <name> version`, the npm page (README, badge) |
| 8 | GitHub release | `gh release create vX.Y.Z --title vX.Y.Z --notes-file <notes>` from the PR's change list, the same day |
| 9 | Follow-ups | Badge or link PRs if the first release lacked them (they show on npm only from the next version), repo "About" homepage, the project's memory or plan updated |

Details and commands: [release steps](references/release-steps.md).

## After the release

- An upstream watch (a monthly workflow that opens an issue when a dependency the tool is built against changes) is
  worth it for a tool that encodes another project's behaviour. See [upstream watch](references/upstream-watch.md).
- Project rules for the next releases: copy [templates/project-rules.md](templates/project-rules.md) into the
  project's `CLAUDE.md`.

## When you finish a step

Say which step is done, what the user has to do next (merge, publish), and the exact command for it.
