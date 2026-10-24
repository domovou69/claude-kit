# dev.to format

What the dev.to editor does with the Markdown, and what to write instead.

## Front matter

```yaml
---
title: "XPath to Android UiSelector: can Claude 5.5 replace a converter?"
published: false
description: "One or two sentences that make someone click; shown in feeds and search."
tags: android, appium, testing, ai
cover_image: https://…/cover.png
---
```

- At most **4 tags**, lower-case letters and digits only (`testautomation`, not `test-automation`).
- `published: false` in the repo copy; the user publishes from the editor.
- `cover_image` is a URL. In the repo copy keep a comment (`# cover_image: upload img/cover.png (1000×420)`) until the
  image is uploaded.
- `canonical_url` only if the article first appeared somewhere else.

## Images

- **No SVG**: dev.to does not take it. Render each chart to PNG at 2× ([charts and cover](charts-and-cover.md)).
- **No relative paths**: `img/chart.png` resolves on GitHub but not on dev.to. Upload the PNG in the editor (dev.to
  hosts it) or use its raw GitHub URL; keep relative paths in the repo copy, and a comment at the top that says so.
- Alt text that says what the chart shows, not "chart".

## Tables

dev.to strips colours, font sizes and column widths, and phones show about 40 characters per line.

- Keep a row under about 100 characters: short headers ("Time, min" in the header, plain numbers in the cells), one
  unit per column. A speed table with mixed ms / s units and long headers wrapped; with all times in ms and short
  headers it fit.
- Put `&nbsp;` between a number and its unit or sign (`78.3&nbsp;%`, `<&nbsp;0.1`): a cell that breaks between the
  number and `%` reads as two values.
- No `<br>` in cells: it renders but is cramped. Use two rows per item (for example one row per model and condition).
- A table whose cells hold sentences (a "trap → why" table with three columns) reads better as a list: the item in
  bold, the explanation on its own line, full width.
- Bold works in cells; colour does not. Mark the reference row (the tool = 100 %) in bold.

## Spoilers and code

- `{% details Summary text %} … {% enddetails %}` for long method notes; GitHub shows the raw tags, so the repo copy
  uses a plain heading or `<details>` instead.
- Fenced code with a language (`bash`, `js`, `diff`). Keep commands copy-paste ready; no prompt sign.
- `{% embed URL %}` for a GitHub repo card is optional; a plain link is enough.

## Links

- Link the npm package, the repository and the playground in the intro, not only at the end.
- Series: each part links the others; when a later part is published, add its link to the earlier ones (in the editor
  and in the repo copy).
