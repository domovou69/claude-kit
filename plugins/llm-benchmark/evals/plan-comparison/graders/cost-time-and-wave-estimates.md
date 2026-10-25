---
type: llm
focus: { source: file, path: PLAN.md }
---

PASS if the plan records cost and time as separate columns per run (taken from the tool's own result, not guessed) AND gives an estimate before each wave of runs, in minutes or hours and as money or a share of the usage window.
FAIL if cost and time are only combined into one figure, or there is no estimate per wave.
