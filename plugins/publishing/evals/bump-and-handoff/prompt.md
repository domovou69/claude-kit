---
name: bump-and-handoff
description: A new version of a released package; expects the version bump, release notes, and a correct handoff of publishing to the user.
tags: [npm-release, bump]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit]
---

Release tallyr 1.4.0 to npm. Changes since 1.3.2: a new --json flag, a fix for a crash on empty files, and support for Node 16 was dropped. Do the release work now: bump the version in this folder and write the description of the release pull request into PR.md. Then tell me what happens next, step by step. I will not be around to answer questions, so decide for me, and do not run anything that publishes or pushes.
