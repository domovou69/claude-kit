---
type: regex
target: { source: file, path: run.js }
pattern: '--bare'
match: not_contains
---

The script does not use --bare, which ignores the subscription login.
