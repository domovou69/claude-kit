---
name: runner-script
description: Writing the script that runs models over an input file with the claude CLI; expects isolation, chunks, resume, cost from the CLI result and no effort max.
tags: [llm-vs-tool, runner]
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write]
---

Write a Node.js script run.js that sends the 600 lines of inputs.txt (one free-form date string per line; the file will be added later) to Claude models through the claude command-line tool, once per model for haiku, sonnet and opus, and saves the answers so we can compare them with our datefmt tool. We may run it for a long time on a laptop.

I will not be around to answer questions, so decide for me: approve any estimate in advance, take your own recommendation wherever there is a choice, and do not run anything or create a repository. Write the files into the current directory.
