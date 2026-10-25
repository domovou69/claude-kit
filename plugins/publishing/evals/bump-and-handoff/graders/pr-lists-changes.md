---
type: regex
target: { source: file, path: PR.md }
pattern: '(?=[\s\S]*--json)(?=[\s\S]*empty)(?=[\s\S]*Node 16)'
flags: i
---

PR.md lists all three changes.
