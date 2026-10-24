<!-- Copy into the project's CLAUDE.md. -->
## README.md is the npm page

`README.md` ships in the npm package and is the page users see on npmjs.com. Keep it short and practical: what the
tool does, how to run it, one example, the key results in a few lines, the versions checked, the library call, links
to the docs, the license. Everything else goes to `docs/` and is linked from the README's "Documentation" list.

When a release adds results, update `docs/` first; touch the README only if one of its headline numbers changes.
README and `package.json` metadata changes reach npmjs.com only with the next publish.

## Releases

- A release is a PR from fresh `main` that bumps `version` in `package.json` and lists the changes in its description.
- After the merge: an annotated tag `vX.Y.Z` on the merge commit; the user runs `npm publish`; then a check with `npx`
  in a clean folder and the GitHub release, the same day.
- Every `bin` file is `100755` in git.
