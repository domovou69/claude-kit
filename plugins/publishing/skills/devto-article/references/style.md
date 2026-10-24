# Style

What worked for articles about a tool and its measurement; ask the user for their own preferences first.

## Structure

1. **TL;DR**: three bullets at the very top, each a claim with its number.
2. The run commands (two lines) right under the TL;DR.
3. **Contents**: a numbered list of the sections, including Limits.
4. Intro: the problem in the reader's words, why it matters, what was built.
5. Sections with final results only. No history of intermediate runs ("the first audit gave 72"), unless the change
   is the story.
6. Scoring explained plainly: what earns 1, 0.5, 0, −1, and why the maximum is not 100.
7. **Limits**: what was not checked (a synthetic app, an emulator only, one run per cell, versions).
8. Short acknowledgements (tools used, for example Claude Code).
9. Author line: name, role, profile link — from the user, never made up.

## Writing

- Short sentences, plain words, one idea per paragraph. English for the article whatever language the chat is in.
- Heavy method details in spoilers (`{% details %}`), so the main text stays readable.
- Honest caveats stay in, especially the ones against the tool ("on a real project it was not faster").
- A strong claim needs its number next to it and its limit near it ("0 wrong" → "on 680 locators, strict scoring").
- When a comparison is involved, the reference is named on every table (the tool = 100 %) and wrong answers have their
  own column (see llm-benchmark:llm-vs-tool).

## Before the user sees it

- Draft → an editorial pass by Claude (cut by a third, check each number) → the user edits.
- `article-check.js`: no FAIL; each WARN read and either fixed or left on purpose.
- Read the rendered Markdown once (GitHub preview of the repo copy) for broken tables and images.
