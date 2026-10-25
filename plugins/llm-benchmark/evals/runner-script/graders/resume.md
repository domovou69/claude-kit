---
type: regex
target: { source: file, path: run.js }
pattern: '(?=[\s\S]*chunk)(?=[\s\S]*(resume|existsSync|already (done|exist)))'
flags: i
---

Finished chunks are detected and skipped on the next start.
