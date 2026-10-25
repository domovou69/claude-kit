---
type: llm
focus: { source: file, path: PLAN.md }
---

PASS if the plan runs every model in an isolated way (a fresh empty folder with only the input, no inherited settings, hooks, tools beyond reading and writing files, saved sessions) AND uses the same prompt text for every model, with any extra rules prompt treated as a separate named condition.
FAIL if runs share a working directory or session, or prompts differ between models without being named conditions.
