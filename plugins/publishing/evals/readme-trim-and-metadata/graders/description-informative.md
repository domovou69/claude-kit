---
type: llm
focus: { source: file, path: package.json }
---

PASS if the package description says what the tool does in words people would search for (for example it counts words in text files) and is more than a few words.
FAIL if it is still "tally stuff" or equally vague.
