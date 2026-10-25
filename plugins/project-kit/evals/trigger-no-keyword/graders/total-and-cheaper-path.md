---
type: regex
target: { source: file, path: PLAN.md }
pattern: '(?=[\s\S]*\btotal\b)(?=[\s\S]*cheap(er|est)?\s+(path|variant|option|route))'
flags: i
---

The plan has a total estimate and a cheaper path.
