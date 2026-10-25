---
type: regex
target: { source: file, path: CLAUDE.md }
pattern: 'co-authored-by'
flags: i
match: not_contains
---

The personal commit rule is not copied into the project CLAUDE.md.
