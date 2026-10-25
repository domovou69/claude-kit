---
type: regex
target: { source: file, path: run.js }
pattern: '^(?!\s*//)[^\n]*(--effort[''", ]+max\b|effort\w*\s*[:=]\s*[''"]max[''"])'
flags: im
match: not_contains
---

No code line configures a run with effort max (comments that say "never max" are fine).
