# After publishing

## Link back, the same day

One PR from fresh `main` (`docs/article-link` or similar):

- `docs/articles/README.md`: the title links to the dev.to URL, the source file next to it.
- README "Documentation": one line, "Article on dev.to", only if the README already lists articles (it is the npm
  page; see publishing:npm-release).
- The other parts of the series: a link to the new part, in the repo copy and (by the user) in the dev.to editor.
- The project's memory or plan: URL and date.

Do not add the link as a commit on the article's branch after that PR was merged: in one project the link commit
landed on the merged branch and needed a second PR to reach `main`.

## Keep both copies in sync

The dev.to copy is edited in the browser; the repo copy is edited in PRs. They drift unless every change goes to
both:

- A numbers fix (one article said "489 of 562" while the data had 563 real locators), a command change (`npx github:…`
  → `npx <name>` after the npm release), a placeholder left in (the author's profile URL): fixed in the repo copy,
  then the PR lists the same edits for the dev.to editor.
- A caption that changed in the repo copy but not on dev.to stays wrong there; the PR says so explicitly, so the user
  can make the edit.
- Re-run `article-check.js` on the repo copy after each sync.

## When the package changes later

- A new flag or default that the article describes differently: add a short "Update (date)" line at the top of the
  dev.to version, not a silent rewrite, and the same in the repo copy.
- A renamed command or a moved doc: fix the links in every published part.
