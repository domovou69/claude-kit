# Plan page (optional)

A read-only progress page at `/plan.html`, built from `PLAN.md` by the same Pages workflow. Useful when people follow
the project; skip it otherwise.

- `PLAN.md` stays the only source. The stage table gets a `Status` column (`done | doing | todo | optional`); each
  backlog item starts with a `[status]` tag.
- `site/plan.js` parses only those two structures. A malformed table, an unknown status or an untagged backlog item
  **throws**, so the build and the check fail instead of shipping a stale page.
- The page: a progress bar, colour per status, the estimate on each row, the full text in a `<details>` dropdown (no
  JavaScript), light and dark, phone width. Leave out internal detail (definitions of done, costs) on purpose.
- Escape every title (`<b>` in a stage name must show as text); relative links in the plan become links to the file on
  GitHub (`https://github.com/OWNER/REPO/blob/main/<path>`).
- The check asserts: every stage and backlog item is on the page, no template placeholder is left, and the three
  failure cases above throw.
