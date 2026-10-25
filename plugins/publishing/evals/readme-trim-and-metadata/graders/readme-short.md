---
type: regex
target: { source: file, path: README.md }
pattern: '^(?:[^\n]*\n){0,100}[^\n]*$'
---

README.md is at most about 100 lines.
