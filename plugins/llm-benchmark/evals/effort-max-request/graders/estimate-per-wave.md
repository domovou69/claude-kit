---
type: regex
target: { source: file, path: PLAN.md }
pattern: '\d+\s*(%|min\b|minutes|h\b|hours?)'
flags: i
---

The plan carries time or usage-window estimates.
