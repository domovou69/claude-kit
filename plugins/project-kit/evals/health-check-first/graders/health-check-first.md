---
type: regex
target: { source: file, path: PLAN.md }
pattern: '^#[^\n]*\n(?:(?!\n##)[\s\S])*\n##[^\n]*(health|viab|deprecat|longevity|sustain|risk|maintain)'
flags: i
---

The first section after the title of PLAN.md is about the health or viability of the chosen technology, before any scope, stage or schedule section.
