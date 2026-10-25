# Release steps

## Before the bump

- **Release review** (first release, and any release after many changes): every number, version, name and link in
  README, `docs/`, plan files, skill files, code comments users see, `package.json` and workflows, checked against
  its source: the test runner's output, generated summaries, `npm pack --dry-run`, the CLI on the README examples.
  One review found 12 stale items: a test count, recomputed timings, a wrong reference id, skip reasons that cited an
  internal decision number a user cannot look up.
- **Tests green on `main`**, and the change list ready: PR titles since the last tag
  (`git log --oneline vX.Y.Z..origin/main`).

## The bump PR

```bash
git fetch origin && git switch -c release/X.Y.Z origin/main
npm version X.Y.Z --no-git-tag-version   # package.json (and the lock file) only; no tag yet
node <skill>/scripts/release-check.js     # on the branch: README, bin, metadata, version, pack
```

- Base `main` (`gh pr create --base main`), or on purpose a long-lived branch the release is cut from (`release/*`, a
  version branch such as `1.x`). Never another open PR's branch: one PR merged into a branch that had already been
  merged never reached `main`, and the fix was a cherry-pick PR.
- Description: [templates/release-pr.md](../templates/release-pr.md) — what changed since the last version, test
  count, `npm pack --dry-run` file count and size, what happens after the merge.
- Version: patch for fixes and docs-only releases, minor for new options or conversions with no API change, major for
  a breaking change.

## After the merge

```bash
git switch main && git pull --ff-only
git show HEAD:package.json | grep '"version"'      # the new version is on main
node <skill>/scripts/release-check.js              # again, on main: no FAIL
git tag -a vX.Y.Z -m vX.Y.Z                       # annotated, on the merge commit
git push origin vX.Y.Z                            # the hook asks
```

Then hand over: "Run `npm publish` in the repository root (on `main`, clean tree)." Do not run it: the hook denies it.
A lightweight tag (`git tag vX.Y.Z` without `-a`) happened twice by hand; the check warns about it.

## After the publish

```bash
cd "$(mktemp -d)" && npx -y <name>@X.Y.Z --version   # the published package, not the clone
npm view <name> version dist-tags
gh release create vX.Y.Z --title vX.Y.Z --notes-file notes.md   # the hook asks
```

- The GitHub release on the same day: in one project four GitHub releases were created together a week after the
  first publish, so the repo showed "no releases" while npm had four versions.
- Then the follow-ups: badge or README PR if anything was missing, the repo "About" homepage, the project's plan or
  memory ("X.Y.Z on npm, tag on <commit>, GitHub release done").

## bin and npx

- `git ls-files -s <bin file>` must show `100755`. Fix: `git update-index --chmod=+x <file>` and commit.
- Why it matters only in a clone: inside the repository `npx <name>` links its cache to the working-tree file; git
  rewrites that file on pull or checkout with the stored mode (`100644`), and the next `npx` fails with
  "Permission denied". Installs from npm get the bit from npm, so no release is needed for this fix alone.
- Keep the executable in a `bin` field pointing at a file with `#!/usr/bin/env node`.
