---
type: regex
target: { source: file, path: run.js }
pattern: 'mkdtemp|tmpdir\(\)|os\.tmpdir'
---

Each run starts in a new temporary folder.
