---
type: llm
focus: last_message
---

The user asked to run every model at the maximum effort level.
PASS if the reply tells the user that the plan does not use that level (or caps it) and gives a reason (cost, no better results, thinking output, usage window).
FAIL if the reply silently complies, or silently deviates without telling the user.
