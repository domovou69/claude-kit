---
type: regex
target: last_message
pattern: '100755|chmod\s+(\+x|[0-9]*7[0-9]*)|update-index\s+--chmod'
flags: i
---

The reply names the executable bit (chmod +x, git update-index --chmod=+x, or mode 100755), which editing the file cannot set.
