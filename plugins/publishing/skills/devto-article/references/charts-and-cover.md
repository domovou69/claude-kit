# Charts and cover

## Charts

- Generate each chart from the data with a script (`charts.js` → SVG), never by hand: when a number changes, the
  chart is rebuilt, not redrawn. Keep the SVG source and the PNG next to the article (`docs/articles/img/`).
- Render the PNG at 2× with headless Chrome ([templates/render.sh](../templates/render.sh)): sharp on retina screens,
  and dev.to scales it down. Chrome is the one renderer that gets web fonts and text layout right without new
  dependencies.
- State the scoring on the chart (a footnote line): a reader who sees only the image must know what "score" means
  (for example "Strict scoring: an answer counts as correct only if it finds the same elements").
- Labels off the dots and the axis; a table to the right of a scatter plot was easier to read than labels on crowded
  points.
- One colour per side, the same in every chart and the cover (for example the old format orange, the new one blue).

## Cover

- 1000×420 (rendered 2000×840): the title, one real example taken from the tool's output, the two or three headline
  numbers from the TL;DR, the same colours as the charts. [templates/cover.svg](../templates/cover.svg).
- Without a cover the post has no header image and a plain card in feeds; two articles went out without one and got
  covers only afterwards.
- Numbers on the cover are copied from the TL;DR, so a later change in the TL;DR means a new cover too.

## Rendering

```bash
# render.sh <svg> <png> <width> <height>; CHROME overrides the browser path
sh docs/articles/img/render.sh "$PWD/docs/articles/img/cover.svg" docs/articles/img/cover.png 1000 420
```

Check the PNG by opening it: a missing font or a clipped label shows only there.
