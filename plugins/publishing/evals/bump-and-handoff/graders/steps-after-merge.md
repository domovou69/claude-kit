---
type: llm
focus: last_message
---

PASS if the step-by-step list covers, in this order: the release pull request from a fresh main (a release/1.4.0 style branch) merged by the user; a tag v1.4.0 on the merge commit; the user publishing; a check of what was published (for example npx tallyr@1.4.0 in a new empty folder, or npm view); a GitHub release.
FAIL if the tag, the check of the published package, or the GitHub release is missing, or the order is wrong (for example publishing before the merge).
