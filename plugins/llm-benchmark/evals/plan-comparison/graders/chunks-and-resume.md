---
type: regex
target: { source: file, path: PLAN.md }
pattern: '(?=[\s\S]*chunk)(?=[\s\S]*(resum|skip(s|ped)?\b|not (be )?re-?run|never re-?run|already (done|finished|saved|valid)))'
flags: i
---

The plan splits the input into chunks and says finished chunks are not run again after an interruption.
