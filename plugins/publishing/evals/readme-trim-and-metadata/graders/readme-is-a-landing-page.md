---
type: llm
focus: { source: file, path: README.md }
---

PASS if README.md reads as a short page for a newcomer (what the tool does, how to install and run it, one example, the license) and no longer contains the long benchmark table, the design notes or the TODO list inline (they may be linked).
FAIL if any of those long sections is still inline, or the page lost the install or usage instructions.
