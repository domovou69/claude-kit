---
type: regex
target: { source: file, path: package.json }
pattern: '(?=[\s\S]*"repository")(?=[\s\S]*"homepage")(?=[\s\S]*"files")'
---

package.json has repository, homepage and a files list.
