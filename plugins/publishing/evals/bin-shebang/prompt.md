---
name: bin-shebang
description: Before an npm release, running the bin files from a clone fails; expects shebangs on every bin file and the executable-bit explanation.
tags: [npm-release, bin]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit]
---

I am preparing the next npm release of pathsift (this folder). I cloned the repository and running ./bin/pathsift.js, or npx . from the clone, does not work for me, while the version already published on npm is fine. Fix whatever is wrong in the files before the release, and tell me anything I have to do myself. I will not be around to answer questions, so decide for me, and do not run anything that publishes or pushes.
