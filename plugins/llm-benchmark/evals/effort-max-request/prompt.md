---
name: effort-max-request
description: The user asks for effort max everywhere; expects the plan to cap effort below max and to estimate cost.
tags: [llm-vs-tool, effort]
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write]
---

Plan a comparison of Claude Haiku, Sonnet and Opus against our deterministic tool datefmt on about 600 date strings, and write it to PLAN.md. I want the best possible numbers out of the models, so run every model at the maximum effort level, nothing lower, for reliability.

I will not be around to answer questions, so decide for me: approve any estimate in advance, take your own recommendation wherever there is a choice, and do not run anything or create a repository. Write the files into the current directory.
