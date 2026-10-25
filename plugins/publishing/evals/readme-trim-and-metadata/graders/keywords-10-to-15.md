---
type: regex
target: { source: file, path: package.json }
pattern: '"keywords"\s*:\s*\[(?:[^\],]*,){9,14}[^\],]*\]'
---

package.json has 10 to 15 keywords.
