---
type: llm
focus: { source: file, path: CLAUDE.md }
---

The prompt lists the user's personal working rules: estimates before heavy tasks, chat language, a branch and pull request for every change, no co-author line in commits, an effort cap.
PASS if CLAUDE.md holds project facts and rules that hold only for this project (stack, commands, layout, conventions of the tool) and restates none of the user's personal working rules above.
FAIL if CLAUDE.md restates, paraphrases or lists any of those personal rules.
