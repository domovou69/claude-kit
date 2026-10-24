<!--
Title: release: X.Y.Z (SHORT REASON)
Base: main (never another PR's branch). Branch: release/X.Y.Z from fresh origin/main.
-->
Version X.Y.Z (PATCH / MINOR / MAJOR: WHY). Only the version in `package.json` changes here; the code is already on
`main`.

## Changes since X.Y.(Z-1)

- CHANGE (#PR)
- CHANGE (#PR)

## Checks

- `npm test`: N passed.
- `npm pack --dry-run`: `PACKAGE-X.Y.Z.tgz`, N files, N kB (as before / +1: WHY).
- `release-check.js`: no FAIL.
- README numbers: unchanged / updated (WHICH).

## After the merge

1. Annotated tag `vX.Y.Z` on the merge commit.
2. The user runs `npm publish`.
3. `npx PACKAGE@X.Y.Z --version` in a clean folder, then the GitHub release `vX.Y.Z` with the list above.
