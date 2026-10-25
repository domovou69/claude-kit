---
name: plan-comparison
description: Planning a comparison of Claude models against a deterministic tool; expects the method rules in the plan.
tags: [llm-vs-tool, plan]
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write]
---

We maintain a command-line tool called datefmt that turns free-form date strings ("3rd of March '24", "yesterday at noon", "2024-03-03T10:00") into ISO 8601. It is deterministic and we trust it. We have about 600 sample inputs. My question: do we still need datefmt if Claude can do the same? Plan a comparison of Claude Haiku, Sonnet and Opus against datefmt on those inputs, and write the plan to PLAN.md.

I will not be around to answer questions, so decide for me: approve any estimate in advance, take your own recommendation wherever there is a choice, and do not run anything or create a repository. Write the files into the current directory.
