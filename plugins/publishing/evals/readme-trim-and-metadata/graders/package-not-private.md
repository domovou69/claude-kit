---
type: regex
target: { source: file, path: package.json }
pattern: '"private"\s*:\s*true'
match: not_contains
---
