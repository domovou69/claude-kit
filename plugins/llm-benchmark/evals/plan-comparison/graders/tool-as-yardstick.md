---
type: llm
focus: { source: file, path: PLAN.md }
---

PASS if scores are expressed relative to the tool (the tool is the reference, 100 %) AND wrong answers are reported in their own column(s), separating answers that look plausible but are wrong from answers the engine rejects as invalid.
FAIL if the plan reports one combined accuracy figure only, or has no column for wrong answers.
