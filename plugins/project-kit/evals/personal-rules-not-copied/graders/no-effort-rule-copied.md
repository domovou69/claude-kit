---
type: regex
target: { source: file, path: CLAUDE.md }
pattern: 'effort\W{0,3}max|max\W{0,3}effort'
flags: i
match: not_contains
---

The personal effort rule is not copied into the project CLAUDE.md.
